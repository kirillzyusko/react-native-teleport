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
  private var isPendingHostAvailability = false

  private fun moveChildrenToTarget(
    source: ViewGroup,
    target: ViewGroup,
  ) {
    val children = mutableListOf<View>()
    val count = source.childCount
    for (i in count - 1 downTo 0) {
      val child = source.getChildAt(i) ?: continue
      children.add(0, child)
      source.removeViewAt(i)
    }

    for (child in children) {
      target.addView(child)
    }
  }

  fun setHostName(name: String?) {
    // Unregister from previous host if pending
    if (isPendingHostAvailability && hostName != null) {
      PortalRegistry.unregisterPendingPortal(hostName!!, this)
      isPendingHostAvailability = false
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
          isPendingHostAvailability = true
          this
        }
      } else {
        this
      }

    moveChildrenToTarget(source = this, target = target)
  }

  internal fun onHostAvailable() {
    isPendingHostAvailability = false

    val host = PortalRegistry.getHost(hostName)
    if (host != null) {
      moveChildrenToTarget(source = this, target = host)
    }
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
    if (isPendingHostAvailability && hostName != null) {
      PortalRegistry.unregisterPendingPortal(hostName!!, this)
      isPendingHostAvailability = false
    }
  }
  // endregion
}
