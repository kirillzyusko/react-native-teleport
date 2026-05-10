package com.teleport.portal

import android.content.Context
import android.view.View
import android.view.ViewGroup
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.global.PortalRegistry
import com.teleport.host.PortalHostView
import java.util.ArrayList

class PortalView(
  context: Context,
) : ReactViewGroup(context) {
  private var hostName: String? = null
  private val ownChildren: MutableList<View> = ArrayList()

  fun setHostName(name: String?) {
    if (name == hostName) return

    val children = extractChildren()

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
  }

  internal fun onHostChanged() {
    val host = PortalRegistry.getHost(hostName)
    if (host != null) {
      // Host appeared (or was replaced). Move children into it, detaching
      // from their current parent first — that may be `this` (initial mount
      // or after host loss) or a stale, detached host view.
      val children: List<View> =
        if (ownChildren.isEmpty()) extractPhysicalChildren() else detachOwnChildren()

      for (i in children.indices) {
        val idx = host.nextInsertionIndexForChildAt(i)
        host.addView(children[i], idx)
      }
      ownChildren.addAll(children)
    } else {
      // Host went away. Pull children back to ourselves so they remain
      // attached to a live view tree and React-driven mutations keep working.
      if (ownChildren.isEmpty()) return
      val list = detachOwnChildren()
      // isTeleported() is now false, so super.addView and addView are equivalent;
      // use super to be explicit that this is a physical re-attach.
      for (i in list.indices) {
        super.addView(list[i], i)
      }
    }
  }

  private fun isTeleported(): Boolean = hostName != null && PortalRegistry.getHost(hostName) != null

  private fun extractPhysicalChildren(): List<View> {
    // Collect children first, then remove via super.removeView(child).
    // Using super.removeViewAt(i) may call our overridden getChildAt(),
    // which can return null during onHostAvailable (isTeleported flips
    // before ownChildren is populated), leading to an NPE in
    // removeViewInternal. super.removeView(View) avoids this by using
    // indexOfChild without re-fetching the view.
    val count = super.getChildCount()
    val children = ArrayList<View>(count)
    for (i in 0 until count) {
      super.getChildAt(i)?.let { children.add(it) }
    }
    for (child in children) {
      super.removeView(child)
    }
    return children
  }

  /**
   * Detaches every view in [ownChildren] from its current parent (which may be
   * `this`, the active host, or a stale/detached host) and clears the list.
   * Returns the detached views in their original order so the caller can
   * re-attach them somewhere else.
   */
  private fun detachOwnChildren(): List<View> {
    val list = ownChildren.toList()
    ownChildren.clear()
    for (child in list) {
      (child.parent as? ViewGroup)?.removeView(child)
    }
    return list
  }

  private fun extractChildren(): List<View> {
    // Gather current children (logical if teleported, physical otherwise)
    return if (isTeleported()) detachOwnChildren() else extractPhysicalChildren()
  }

  /**
   * Finds the host index of the first next sibling (in [ownChildren]) that is
   * already present in the host.  Returns -1 when none is found (caller should append).
   */
  private fun findNextSiblingHostIndex(
    host: ViewGroup,
    ownIndex: Int,
  ): Int {
    for (i in (ownIndex + 1) until ownChildren.size) {
      val sibling = ownChildren[i]
      val siblingIndex = host.indexOfChild(sibling)
      if (siblingIndex >= 0) return siblingIndex
    }
    return -1
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
      ownChildren.add(index, child)
      if (host != null) {
        val hostIndex = findNextSiblingHostIndex(host, index)
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
    if (isTeleported()) {
      val host = PortalRegistry.getHost(hostName)
      ownChildren.add(index, child)
      if (host != null) {
        val hostIndex = findNextSiblingHostIndex(host, index)
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
}
