package com.teleport.host

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import com.facebook.react.ReactRootView
import com.facebook.react.uimanager.PointerEvents
import com.teleport.common.ReparentableReactViewGroup
import com.teleport.global.PortalRegistry
import com.teleport.portal.PortalStackContainer

private class FullScreenPortalContainer(
  context: Context?,
) : ReparentableReactViewGroup(context) {
  override fun addView(
    child: View,
    index: Int,
  ) {
    // The fast reparent path leaves the child attached to the same window.
    // addView() would dispatch attachment again; pair detach with attach instead.
    if (child.parent == null && child.isAttachedToWindow) {
      attachDetachedView(child, index)
    } else {
      super.addView(child, index)
    }
  }
}

/**
 * Keeps Fabric ownership at the declared anchor while optionally hosting the
 * physical children at the React surface root. Never creates an Android Window.
 */
class PortalHostView(
  context: Context?,
) : ReparentableReactViewGroup(context) {
  private var name: String? = null
  private var isInBatch = false
  private var batchBaseIndex = 0
  private var pendingCleanupViewId: Int? = null
  internal var fullScreen = false
    set(value) {
      if (field != value) {
        field = value
        updateOverlay()
      }
    }
  private var overlay: FullScreenPortalContainer? = null
  private var overlayRoot: ViewGroup? = null
  private var isDetaching = false
  private val rootLayoutListener = View.OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> layoutOverlay() }

  // All insertion, ordering and measurement must use this destination. The
  // anchor's own bounds can be zero or restricted to a navigation screen.
  internal val portalContainer: ViewGroup
    get() = overlay ?: this

  // region ViewManager methods
  fun setName(newName: String?) {
    if (name == newName) return

    name?.let { PortalRegistry.unregisterHost(it, id) }
    name = newName
    newName?.let { PortalRegistry.registerHost(it, this) }
  }

  private fun updateOverlay() {
    if (!fullScreen || !isAttachedToWindow) {
      removeOverlay()
    } else if (overlay == null) {
      findReactSurface()?.let(::createOverlay)
    }
  }

  private fun findReactSurface(): ReactRootView? {
    // Stay in the React surface; native Dialog windows remain above it.
    var ancestor = parent
    var root: ReactRootView? = null
    while (ancestor is View) {
      if (ancestor is ReactRootView) root = ancestor
      ancestor = ancestor.parent
    }
    return root
  }

  private fun createOverlay(surface: ReactRootView) {
    val container = FullScreenPortalContainer(context)
    container.pointerEvents = PointerEvents.BOX_NONE
    container.clipChildren = false
    // Snapshot before mutation: ViewGroup child indices change during removal.
    // Move existing groups as units so toggling fullScreen keeps their contents.
    val children = (0 until super.getChildCount()).mapNotNull { super.getChildAt(it) }
    for (child in children) super.removeView(child)
    overlay = container
    overlayRoot = surface
    surface.addView(
      container,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    for (child in children) container.addView(child)
    surface.addOnLayoutChangeListener(rootLayoutListener)
    layoutOverlay()
    name?.let { PortalRegistry.notifyHostLayoutChanged(it) }
  }

  private fun layoutOverlay() {
    val root = overlayRoot ?: return
    val container = overlay ?: return
    // The container is outside Fabric's physical layout tree. Measure it here,
    // then publish the destination bounds through each Portal's layout state.
    container.measure(
      MeasureSpec.makeMeasureSpec(root.width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(root.height, MeasureSpec.EXACTLY),
    )
    container.layout(0, 0, root.width, root.height)
    name?.let { PortalRegistry.notifyHostLayoutChanged(it) }
  }

  private fun removeOverlay() {
    val container = overlay ?: return
    if (isDetaching) {
      container.visibility = View.GONE
      // Root attachment traversals must finish before removing a sibling.
      post {
        // The host can be recycled or reattached before this callback runs.
        // Never remove a replacement container, or flash one kept on the same root.
        if (overlay === container) {
          if (isAttachedToWindow && fullScreen && overlayRoot === findReactSurface()) {
            container.visibility = View.VISIBLE
          } else {
            removeOverlay()
            updateOverlay()
          }
        }
      }
      return
    }
    val children = (0 until container.childCount).mapNotNull { container.getChildAt(it) }
    // Restore children to the anchor before removing the external destination,
    // so subsequent Fabric unmount operations still have an owning container.
    overlay = null
    for (child in children) {
      container.removeView(child)
      super.addView(child, super.getChildCount())
    }
    overlayRoot?.removeOnLayoutChangeListener(rootLayoutListener)
    overlayRoot?.removeView(container)
    overlayRoot = null
    name?.let { PortalRegistry.notifyHostLayoutChanged(it) }
  }

  internal fun sortPortals() {
    val container = portalContainer
    val groups =
      (0 until container.childCount)
        .mapNotNull { container.getChildAt(it) as? PortalStackContainer }
        .sortedWith(compareBy<PortalStackContainer> { it.stackOrder }.thenBy { it.mountOrder })
    // Layout notifications do not necessarily change order. Repeatedly cycling
    // every child to the front would churn the hierarchy and request more layouts.
    val start = container.childCount - groups.size
    if (groups.indices.all { container.getChildAt(start + it) === groups[it] }) return
    // Reorder existing groups without detach/attach callbacks. Keep each dialog's
    // backdrop and content together, with physical hit order matching draw order.
    for (group in groups) container.bringChildToFront(group)
  }

  fun cleanup(viewId: Int) {
    if (isAttachedToWindow) {
      pendingCleanupViewId = viewId
      return
    }

    cleanupNow(viewId)
  }
  // endregion

  // region Portal insertion

  /**
   * Returns the index at which a portal child should be inserted.
   *
   * Within a single Fabric commit all mutations run synchronously on the main
   * thread.  The first call in a commit records the current child count as
   * the "base"; subsequent calls in the same commit reuse that base so that
   * bottom-to-top Fabric ordering is compensated by [addView] at a specific index.
   * A [Handler.post] resets the flag after the commit finishes.
   */
  fun nextInsertionIndexForChildAt(childIndex: Int): Int {
    if (!isInBatch) {
      isInBatch = true
      batchBaseIndex = portalContainer.childCount
      Handler(Looper.getMainLooper()).post { isInBatch = false }
    }
    return minOf(batchBaseIndex + childIndex, portalContainer.childCount)
  }

  override fun addView(
    child: View,
    index: Int,
  ) {
    if (child.parent != null || !child.isAttachedToWindow) {
      super.addView(child, index)
      return
    }

    attachDetachedView(child, index)
  }

  // endregion

  // region Lifecycle
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()

    val attachedName = name ?: return
    // ViewGroup invokes onAttachedToWindow before dispatching attachment to
    // its children. Wait until that traversal finishes before moving an
    // already-attached portal child into this host.
    post {
      if (isAttachedToWindow && name == attachedName) {
        updateOverlay()
        PortalRegistry.notifySubscribers(attachedName)
      }
    }
  }

  override fun onLayout(
    changed: Boolean,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
  ) {
    super.onLayout(changed, left, top, right, bottom)
    name?.let { PortalRegistry.notifyHostLayoutChanged(it) }
  }

  override fun onDetachedFromWindow() {
    isDetaching = true
    try {
      removeOverlay()
      super.onDetachedFromWindow()

      val cleanupViewId = pendingCleanupViewId
      if (cleanupViewId != null) {
        cleanupNow(cleanupViewId)
      } else {
        val detachedName = name ?: return
        // The parent may still be dispatching detachment to sibling views.
        // Resolve the fallback after that traversal so we do not attach a child
        // to a sibling that is about to be detached in the same pass.
        post {
          if (name == detachedName) {
            PortalRegistry.notifySubscribers(detachedName)
          }
        }
      }
    } finally {
      isDetaching = false
    }
  }
  // endregion

  // region Helpers
  private fun cleanupNow(viewId: Int) {
    name?.let { PortalRegistry.unregisterHost(it, viewId) }
    name = null
    fullScreen = false
    removeOverlay()
    isInBatch = false
    batchBaseIndex = 0
    pendingCleanupViewId = null
  }
  // endregion
}
