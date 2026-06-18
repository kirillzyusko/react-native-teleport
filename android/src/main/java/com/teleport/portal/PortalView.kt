package com.teleport.portal

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityEvent
import com.facebook.react.uimanager.StateWrapper
import com.teleport.common.ReparentableReactViewGroup
import com.teleport.extensions.canReparentAttached
import com.teleport.extensions.findNextSiblingHostIndex
import com.teleport.global.PortalRegistry
import com.teleport.host.PortalHostView
import java.util.ArrayList

class PortalView(
  context: Context,
) : ReparentableReactViewGroup(context),
  PortalViewLifecycle {
  private var hostName: String? = null
  private var sourceName: String? = null
  private val layoutStateController = PortalLayoutStateController(this)
  private val ownChildren: MutableList<View> = ArrayList()

  private val isTeleported: Boolean
    get() = hostName != null && PortalRegistry.getHost(hostName) != null

  // region ViewManager methods
  override fun setStateWrapper(wrapper: StateWrapper?) {
    layoutStateController.setStateWrapper(wrapper)
    layoutStateController.updateIfNeeded(hostName, PortalRegistry.getHost(hostName))
  }

  override fun setName(name: String?) {
    if (name == sourceName) return

    sourceName?.let { PortalRegistry.unregisterPortalSource(it, this) }
    sourceName = name
    notifyMirrorsIfRegistered()
  }

  override fun setHostName(name: String?) {
    if (name == hostName) return

    val children = extractChildren(name)

    hostName?.let { PortalRegistry.unregisterPendingPortal(it, this) }

    hostName = name

    val target: ViewGroup = name?.let { PortalRegistry.getHost(it) } ?: this

    if (target is PortalHostView) {
      for (i in children.indices) {
        val idx = target.nextInsertionIndexForChildAt(i)
        target.addView(children[i], idx)
      }
      ownChildren.addAll(children)
    } else {
      for (i in children.indices) {
        target.addView(children[i], i)
      }
    }

    name?.let { PortalRegistry.registerPendingPortal(it, this) }
    notifyMirrorsIfRegistered()
    layoutStateController.updateIfNeeded(hostName, PortalRegistry.getHost(hostName))
  }

  override fun cleanup() {
    hostName?.let { PortalRegistry.unregisterPendingPortal(it, this) }
    sourceName?.let { PortalRegistry.unregisterPortalSource(it, this) }
    detachOwnChildren()
    hostName = null
    sourceName = null
    layoutStateController.resetIfNeeded()
    layoutStateController.setStateWrapper(null)
  }
  // endregion

  // region Host lifecycle callbacks
  internal fun onHostChanged() {
    val host = PortalRegistry.getHost(hostName)
    if (host != null) {
      // Host appeared (or was replaced). Move children into it, detaching
      // from their current parent first — that may be `this` (initial mount
      // or after host loss) or a stale, detached host view.
      val children: List<View> =
        if (ownChildren.isEmpty()) extractPhysicalChildren(host) else detachOwnChildren(host)

      for (i in children.indices) {
        val idx = host.nextInsertionIndexForChildAt(i)
        host.addView(children[i], idx)
      }
      ownChildren.addAll(children)
    } else {
      // Host went away. Pull children back to ourselves so they remain
      // attached to a live view tree and React-driven mutations keep working.
      if (ownChildren.isEmpty()) {
        layoutStateController.resetIfNeeded()
        return
      }
      val list = detachOwnChildren(this)
      // A child moved via detachViewFromParent remains attached to the window.
      // Use our override so it is reattached via attachViewToParent.
      for (i in list.indices) {
        addView(list[i], i)
      }
      layoutStateController.resetIfNeeded()
    }
    notifyMirrorsIfRegistered()
  }

  private fun notifyMirrorsIfRegistered() {
    if (isAttachedToWindow) {
      sourceName?.let { PortalRegistry.registerPortalSource(it, this) }
    }
  }

  internal fun onHostLayoutChanged() {
    layoutStateController.updateIfNeeded(hostName, PortalRegistry.getHost(hostName))
  }
  // endregion

  // region Child relocation helpers
  private fun extractPhysicalChildren(target: ViewGroup): List<View> {
    // Collect children first, then detach them.
    // Using super.removeViewAt(i) may call our overridden getChildAt(),
    // which can return null during onHostAvailable (isTeleported flips
    // before ownChildren is populated), leading to an NPE in
    // removeViewInternal. The removeView fallback avoids this by using
    // indexOfChild without re-fetching the view.
    val count = super.getChildCount()
    val children = ArrayList<View>(count)
    for (i in 0 until count) {
      super.getChildAt(i)?.let { children.add(it) }
    }
    for (child in children) {
      detachFromParent(child, target)
    }
    return children
  }

  private fun detachFromParent(
    child: View,
    target: ViewGroup? = null,
  ) {
    val parent = child.parent as? ViewGroup ?: return

    if (
      target != null &&
      parent is ReparentableReactViewGroup &&
      child.canReparentAttached(parent, target)
    ) {
      parent.detachForReparent(child)
    } else if (parent === this) {
      super.removeView(child)
    } else {
      parent.removeView(child)
    }

    if (child.parent === parent) {
      parent.endViewTransition(child)
    }
  }

  /**
   * Detaches every view in [ownChildren] from its current parent (which may be
   * `this`, the active host, or a stale/detached host) and clears the list.
   * Returns the detached views in their original order so the caller can
   * re-attach them somewhere else.
   */
  private fun detachOwnChildren(target: ViewGroup? = null): List<View> {
    val list = ArrayList<View>(ownChildren.size)
    for (child in ownChildren) {
      if (!list.contains(child)) {
        list.add(child)
      }
    }
    ownChildren.clear()
    for (child in list) {
      detachFromParent(child, target)
    }
    return list
  }

  private fun extractChildren(targetName: String?): List<View> {
    // Gather current children (logical if teleported, physical otherwise)
    val target: ViewGroup = targetName?.let { PortalRegistry.getHost(it) } ?: this
    return if (isTeleported) detachOwnChildren(target) else extractPhysicalChildren(target)
  }
  // endregion

  // region Children management
  override fun getChildCount(): Int =
    if (isTeleported) {
      ownChildren.size
    } else {
      super.getChildCount()
    }

  override fun getChildAt(index: Int): View? =
    if (isTeleported) {
      ownChildren.getOrNull(index)
    } else {
      super.getChildAt(index)
    }

  override fun addView(
    child: View,
    index: Int,
  ) {
    if (child.parent == null && child.isAttachedToWindow) {
      attachDetachedView(child, index)
    } else if (isTeleported) {
      val host = PortalRegistry.getHost(hostName)
      ownChildren.add(index, child)
      if (host != null) {
        val hostIndex = ownChildren.findNextSiblingHostIndex(host, index)
        if (hostIndex >= 0) {
          host.addView(child, hostIndex)
        } else {
          host.addView(child)
        }
      }
    } else {
      super.addView(child, index)
    }
    notifyMirrorsIfRegistered()
  }

  override fun addView(
    child: View,
    index: Int,
    params: LayoutParams,
  ) {
    if (isTeleported) {
      val host = PortalRegistry.getHost(hostName)
      ownChildren.add(index, child)
      if (host != null) {
        val hostIndex = ownChildren.findNextSiblingHostIndex(host, index)
        if (hostIndex >= 0) {
          host.addView(child, hostIndex)
        } else {
          host.addView(child, params)
        }
      }
    } else {
      super.addView(child, index, params)
    }
    notifyMirrorsIfRegistered()
  }

  override fun removeView(view: View?) {
    if (view == null) return
    if (isTeleported) {
      val host = PortalRegistry.getHost(hostName)
      host?.removeView(view)
      ownChildren.remove(view)
    } else {
      super.removeView(view)
    }
    notifyMirrorsIfRegistered()
  }

  override fun removeViewAt(index: Int) {
    if (isTeleported) {
      val host = PortalRegistry.getHost(hostName)
      val view = ownChildren.getOrNull(index)
      if (view != null) {
        host?.removeView(view)
        ownChildren.removeAt(index)
      }
    } else {
      super.removeViewAt(index)
    }
    notifyMirrorsIfRegistered()
  }
  // endregion

  // region Lifecycle
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    notifyMirrorsIfRegistered()
    layoutStateController.updateIfNeeded(hostName, PortalRegistry.getHost(hostName))
  }

  override fun onDetachedFromWindow() {
    layoutStateController.resetIfNeeded()
    sourceName?.let { PortalRegistry.unregisterPortalSource(it, this) }
    super.onDetachedFromWindow()
  }

  override fun onLayout(
    changed: Boolean,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
  ) {
    super.onLayout(changed, left, top, right, bottom)
    layoutStateController.updateIfNeeded(hostName, PortalRegistry.getHost(hostName))
  }

  override fun onSizeChanged(
    w: Int,
    h: Int,
    oldw: Int,
    oldh: Int,
  ) {
    super.onSizeChanged(w, h, oldw, oldh)
    notifyMirrorsIfRegistered()
  }
  // endregion

  // region Accessibility
  // Override to prevent accessibility from trying to include non-descendant children
  override fun addChildrenForAccessibility(outChildren: ArrayList<View>) {
    if (!isTeleported) {
      super.addChildrenForAccessibility(outChildren)
    }
    // When teleported, do nothing—children are handled by the host's accessibility tree
  }

  // A teleported child is no longer a physical descendant of this view.
  // The host traverses it at its actual location instead.
  override fun dispatchPopulateAccessibilityEvent(event: AccessibilityEvent): Boolean =
    if (isTeleported) false else super.dispatchPopulateAccessibilityEvent(event)
  // endregion
}
