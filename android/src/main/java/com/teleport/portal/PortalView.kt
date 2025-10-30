package com.teleport.portal

import android.content.Context
import android.view.View
import android.view.ViewGroup
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.global.PortalRegistry
import java.util.ArrayList

class PortalView(
  context: Context,
) : ReactViewGroup(context) {
  private var hostName: String? = null
  private var isWaitingForHost = false

  fun setHostName(name: String?) {
    // Unregister from previous host if pending
    if (isWaitingForHost && hostName != null) {
      PortalRegistry.unregisterPendingPortal(hostName!!, this)
      isWaitingForHost = false
    }

    // Gather children BEFORE updating hostName, since getChildCount() and getChildAt() depend on it
    val children = mutableListOf<View>()
    val count = childCount
    for (i in count - 1 downTo 0) {
      val child = getChildAt(i) ?: continue
      children.add(0, child)
      removeViewAt(i)
    }

    hostName = name

    val target: ViewGroup =
      if (hostName != null) {
        val host = PortalRegistry.getHost(hostName)
        if (host != null) {
          host
        } else {
          // Host not available yet, register as pending
          PortalRegistry.registerPendingPortal(hostName!!, this)
          isWaitingForHost = true
          this
        }
      } else {
        this
      }

    // Add children to target
    for (child in children) {
      target.addView(child)
    }

    requestLayout()
  }

  internal fun onHostAvailable() {
    isWaitingForHost = false

    val host = PortalRegistry.getHost(hostName)
    if (host != null) {
      // Use super methods to get actual children from this view, not from the host
      val children = mutableListOf<View>()
      val count = super.getChildCount()
      for (i in count - 1 downTo 0) {
        val child = super.getChildAt(i) ?: continue
        children.add(0, child)
        super.removeViewAt(i)
      }

      for (child in children) {
        host.addView(child)
      }
    }

    requestLayout()
  }

  private fun isTeleported(): Boolean = hostName != null && PortalRegistry.getHost(hostName) != null

  // region Children management
  override fun getChildCount(): Int =
    if (isTeleported()) {
      PortalRegistry.getHost(hostName)?.childCount ?: 0
    } else {
      super.getChildCount()
    }

  override fun getChildAt(index: Int): View? =
    if (isTeleported()) {
      PortalRegistry.getHost(hostName)?.getChildAt(index)
    } else {
      super.getChildAt(index)
    }

  override fun addView(
    child: View,
    index: Int,
  ) {
    if (isTeleported()) {
      PortalRegistry.getHost(hostName)?.addView(child, index) ?: super.addView(child, index)
    } else {
      super.addView(child, index)
    }
  }

  override fun addView(
    child: View,
    index: Int,
    params: ViewGroup.LayoutParams,
  ) {
    if (isTeleported()) {
      PortalRegistry.getHost(hostName)?.addView(child, index, params) ?: super.addView(child, index, params)
    } else {
      super.addView(child, index, params)
    }
  }

  override fun removeView(view: View) {
    if (isTeleported()) {
      PortalRegistry.getHost(hostName)?.removeView(view) ?: super.removeView(view)
    } else {
      super.removeView(view)
    }
  }

  override fun removeViewAt(index: Int) {
    if (isTeleported()) {
      PortalRegistry.getHost(hostName)?.removeViewAt(index) ?: super.removeViewAt(index)
    } else {
      super.removeViewAt(index)
    }
  }
  // endregion

  // region Accessibility
  // Override to prevent accessibility from trying to include non-descendant children
  override fun addChildrenForAccessibility(outChildren: ArrayList<View>) {
    if (!isTeleported()) {
      super.addChildrenForAccessibility(outChildren)
    }
    // When teleported, do nothing—children are handled by the host's accessibility tree
  }
  // endregion

  // region Lifecycle
  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    if (isWaitingForHost && hostName != null) {
      PortalRegistry.unregisterPendingPortal(hostName!!, this)
      isWaitingForHost = false
    }
  }
  // endregion
}
