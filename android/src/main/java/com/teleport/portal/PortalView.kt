package com.teleport.portal

import android.content.Context
import android.view.View
import android.view.ViewGroup
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.global.PortalRegistry
import java.util.ArrayList
import java.util.concurrent.atomic.AtomicInteger

class PortalView(
  context: Context,
) : ReactViewGroup(context) {
  private var hostName: String? = null
  private var isWaitingForHost = false
  private val ownChildren: MutableList<View> = ArrayList()
  private var portalZIndex: Int = 0

  companion object {
    // Global counter for z-ordering of portals - ensures later portals appear on top
    private val zIndexCounter = AtomicInteger(0)
    private const val BASE_ELEVATION = 10f
    private const val ELEVATION_INCREMENT = 1f
  }

  private fun applyElevation(child: View) {
    // Use translationZ for proper z-ordering on Android API 21+
    // This ensures nested portals (e.g., nested bottom sheets) render on top
    child.translationZ = BASE_ELEVATION + (portalZIndex * ELEVATION_INCREMENT)
  }

  fun setHostName(name: String?) {
    val children = extractChildren()

    if (isWaitingForHost) {
      hostName?.let { PortalRegistry.unregisterPendingPortal(it, this) }
      isWaitingForHost = false
    }

    hostName = name

    // Assign a new z-index when teleporting to a host
    portalZIndex = if (name != null) zIndexCounter.incrementAndGet() else 0

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

    for (i in children.indices) {
      val child = children[i]
      // Append if to host, preserve index if to self
      target.addView(child, if (target == this) i else -1)
      // Apply elevation and bring to front for proper stacking order
      if (target != this) {
        applyElevation(child)
        child.bringToFront()
      } else {
        // Reset translationZ when un-teleporting back to self
        child.translationZ = 0f
      }
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
      // Assign a new z-index when host becomes available
      portalZIndex = zIndexCounter.incrementAndGet()

      // Gather from self (physical, since waiting)
      val children = extractPhysicalChildren()

      for (child in children) {
        host.addView(child)
        applyElevation(child)
        child.bringToFront()
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
      applyElevation(child)
      child.bringToFront()
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
      applyElevation(child)
      child.bringToFront()
      ownChildren.add(index, child)
    } else {
      super.addView(child, index, params)
    }
  }

  override fun removeView(view: View) {
    // Reset translationZ before removal to prevent stale values in recycled views
    view.translationZ = 0f
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
        // Reset translationZ before removal to prevent stale values in recycled views
        view.translationZ = 0f
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
}
