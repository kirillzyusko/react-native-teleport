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
  private var currentHost: PortalHostView? = null
  private val layoutStateController = PortalLayoutStateController(this)
  private val ownChildren: MutableList<View> = ArrayList()

  private val isTeleported: Boolean
    get() = currentHost != null

  // region ViewManager methods
  override fun setStateWrapper(wrapper: StateWrapper?) {
    layoutStateController.setStateWrapper(wrapper)
    layoutStateController.updateIfNeeded(hostName, currentHost)
  }

  override fun setHostName(name: String?) {
    if (name == hostName) return

    hostName?.let { PortalRegistry.unregisterPendingPortal(it, this) }

    hostName = name
    name?.let { PortalRegistry.registerPendingPortal(it, this) }

    moveChildrenTo(PortalRegistry.getAttachedHost(name))
    layoutStateController.updateIfNeeded(hostName, currentHost)
  }

  override fun cleanup() {
    hostName?.let { PortalRegistry.unregisterPendingPortal(it, this) }
    detachOwnChildren()
    hostName = null
    currentHost = null
    layoutStateController.resetIfNeeded()
    layoutStateController.setStateWrapper(null)
  }
  // endregion

  // region Host lifecycle callbacks
  internal fun onHostChanged() {
    moveChildrenTo(PortalRegistry.getAttachedHost(hostName))
    layoutStateController.updateIfNeeded(hostName, currentHost)
  }

  internal fun onHostLayoutChanged() {
    layoutStateController.updateIfNeeded(hostName, currentHost)
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

  private fun moveChildrenTo(host: PortalHostView?) {
    if (host === currentHost) return

    val target: ViewGroup = host ?: this
    val children = extractChildren(target)
    currentHost = host

    if (host != null) {
      for (i in children.indices) {
        val idx = host.nextInsertionIndexForChildAt(i)
        host.addView(children[i], idx)
      }
      ownChildren.addAll(children)
    } else {
      // A child moved via detachViewFromParent remains attached to the window.
      // Use our override so it is reattached via attachViewToParent.
      for (i in children.indices) {
        addView(children[i], i)
      }
    }
  }

  private fun extractChildren(target: ViewGroup): List<View> {
    // Gather current children (logical if teleported, physical otherwise)
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
      ownChildren.add(index, child)
      currentHost?.let { host ->
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
  }

  override fun addView(
    child: View,
    index: Int,
    params: LayoutParams,
  ) {
    if (isTeleported) {
      ownChildren.add(index, child)
      currentHost?.let { host ->
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
  }

  override fun removeView(view: View?) {
    if (view == null) return
    if (isTeleported) {
      currentHost?.removeView(view)
      ownChildren.remove(view)
    } else {
      super.removeView(view)
    }
  }

  override fun removeViewAt(index: Int) {
    if (isTeleported) {
      val view = ownChildren.getOrNull(index)
      if (view != null) {
        currentHost?.removeView(view)
        ownChildren.removeAt(index)
      }
    } else {
      super.removeViewAt(index)
    }
  }
  // endregion

  // region Lifecycle
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    layoutStateController.updateIfNeeded(hostName, currentHost)
  }

  override fun onDetachedFromWindow() {
    layoutStateController.resetIfNeeded()
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
    layoutStateController.updateIfNeeded(hostName, currentHost)
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
