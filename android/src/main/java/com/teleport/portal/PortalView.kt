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
  private val ownChildren: MutableList<View> = ArrayList()

  fun setHostName(name: String?) {
    val children = extractChildren()

    if (isWaitingForHost) {
      hostName?.let { PortalRegistry.unregisterPendingPortal(it, this) }
      isWaitingForHost = false
    }

    hostName = name

    val target: ViewGroup =
      hostName?.let { hostNameValue ->
        val host = PortalRegistry.getHost(hostNameValue)
        if (host != null) {
          host
        } else {
          PortalRegistry.registerPendingPortal(hostNameValue, this)
          isWaitingForHost = true
          this
        }
      } ?: this

    // Add children to new target
    for (i in children.indices) {
      val child = children[i]
      target.addView(child, if (target == this) i else -1) // Append if to host, preserve index if to self
    }

    // Track own children if teleported
    if (target != this) {
      ownChildren.addAll(children)
    }
  }

  internal fun onHostAvailable() {
    isWaitingForHost = false

    val host = PortalRegistry.getHost(hostName)
    if (host != null) {
      // Gather from self (physical, since waiting)
      val children = extractPhysicalChildren()

      for (child in children) {
        host.addView(child)
      }
      ownChildren.addAll(children)
    }
  }

  private fun isTeleported(): Boolean = hostName != null && PortalRegistry.getHost(hostName) != null

  private fun extractPhysicalChildren(): List<View> {
    val children = mutableListOf<View>()
    val count = super.getChildCount()
    for (i in count - 1 downTo 0) {
      val child = super.getChildAt(i) ?: continue
      children.add(0, child)
      super.removeViewAt(i)
    }

    return children
  }

  private fun extractTeleportedChildren(): List<View> {
    val oldHost = hostName?.let { PortalRegistry.getHost(it) }
    val temp = ownChildren.toList()
    for (child in temp) {
      oldHost?.removeView(child)
    }
    ownChildren.clear()

    return temp
  }

  private fun extractChildren(): List<View> {
    // Gather current children (logical if teleported, physical otherwise)
    val children: List<View> =
      if (isTeleported()) {
        extractTeleportedChildren()
      } else {
        extractPhysicalChildren()
      }

    return children
  }

  // region Children management
  override fun getChildCount(): Int =
    if (isTeleported()) {
      ownChildren.size
    } else {
      super.getChildCount()
    }

  override fun getChildAt(index: Int): View? =
    if (isTeleported()) {
      ownChildren.getOrNull(index)
    } else {
      super.getChildAt(index)
    }

  override fun addView(
    child: View,
    index: Int,
  ) {
    if (isTeleported()) {
      val host = PortalRegistry.getHost(hostName)
      host?.addView(child, index)
      ownChildren.add(index, child)
    } else {
      super.addView(child, index)
    }
  }

  override fun addView(
    child: View,
    index: Int,
    params: LayoutParams,
  ) {
    if (isTeleported()) {
      val host = PortalRegistry.getHost(hostName)
      host?.addView(child, index, params)
      ownChildren.add(index, child)
    } else {
      super.addView(child, index, params)
    }
  }

  override fun removeView(view: View) {
    if (isTeleported()) {
      val host = PortalRegistry.getHost(hostName)
      host?.removeView(view)
      ownChildren.remove(view)
    } else {
      super.removeView(view)
    }
  }

  override fun removeViewAt(index: Int) {
    if (isTeleported()) {
      val host = PortalRegistry.getHost(hostName)
      val view = ownChildren.getOrNull(index)
      if (view != null) {
        host?.removeView(view)
        ownChildren.removeAt(index)
      }
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
    if (isWaitingForHost) {
      hostName?.let { PortalRegistry.unregisterPendingPortal(it, this) }
      isWaitingForHost = false
    }
    if (isTeleported()) {
      val host = PortalRegistry.getHost(hostName)
      for (child in ownChildren) {
        host?.removeView(child)
      }
      ownChildren.clear()
    }
  }
  // endregion
}
