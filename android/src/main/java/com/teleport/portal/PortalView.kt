package com.teleport.portal

import android.content.Context
import android.view.View
import android.view.ViewGroup
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.StateWrapper
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.global.PortalRegistry
import com.teleport.host.PortalHostView
import java.util.ArrayList
import kotlin.math.abs

class PortalView(
  context: Context,
) : ReactViewGroup(context) {
  private var hostName: String? = null
  private var lastHostLayout: HostLayoutState? = null
  private var stateWrapper: StateWrapper? = null
  private val ownChildren: MutableList<View> = ArrayList()

  fun setStateWrapper(wrapper: StateWrapper?) {
    stateWrapper = wrapper
    updatePortalLayoutStateIfNeeded()
  }

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
    updatePortalLayoutStateIfNeeded()
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
      updatePortalLayoutStateIfNeeded()
    } else {
      // Host went away. Pull children back to ourselves so they remain
      // attached to a live view tree and React-driven mutations keep working.
      if (ownChildren.isEmpty()) {
        resetPortalLayoutStateIfNeeded()
        return
      }
      val list = detachOwnChildren()
      // isTeleported() is now false, so super.addView and addView are equivalent;
      // use super to be explicit that this is a physical re-attach.
      for (i in list.indices) {
        super.addView(list[i], i)
      }
      resetPortalLayoutStateIfNeeded()
    }
  }

  internal fun onHostLayoutChanged() {
    updatePortalLayoutStateIfNeeded()
  }

  fun cleanup() {
    hostName?.let { PortalRegistry.unregisterPendingPortal(it, this) }
    detachOwnChildren()
    hostName = null
    resetPortalLayoutStateIfNeeded()
    stateWrapper = null
  }

  private fun isTeleported(): Boolean = hostName != null && PortalRegistry.getHost(hostName) != null

  private fun updatePortalLayoutStateIfNeeded() {
    val wrapper = stateWrapper ?: return
    val host = PortalRegistry.getHost(hostName)

    if (hostName == null || host == null || !isAttachedToWindow || !host.isAttachedToWindow) {
      resetPortalLayoutStateIfNeeded()
      return
    }

    if (host.width == 0 || host.height == 0) return

    val sourceLocation = IntArray(2)
    val hostLocation = IntArray(2)
    getLocationOnScreen(sourceLocation)
    host.getLocationOnScreen(hostLocation)

    val nextState =
      HostLayoutState(
        width = PixelUtil.toDIPFromPixel(host.width.toFloat()),
        height = PixelUtil.toDIPFromPixel(host.height.toFloat()),
        offsetX = PixelUtil.toDIPFromPixel((hostLocation[0] - sourceLocation[0]).toFloat()),
        offsetY = PixelUtil.toDIPFromPixel((hostLocation[1] - sourceLocation[1]).toFloat()),
        hasHostLayout = true,
      )

    if (lastHostLayout?.nearlyEquals(nextState) == true) return

    lastHostLayout = nextState
    wrapper.updateState(nextState.toMap())
  }

  private fun resetPortalLayoutStateIfNeeded() {
    val wrapper = stateWrapper ?: return
    val currentState = lastHostLayout
    if (currentState != null && !currentState.hasHostLayout) return

    val nextState = HostLayoutState.EMPTY
    lastHostLayout = nextState
    wrapper.updateState(nextState.toMap())
  }

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
      detachFromParent(child)
    }
    return children
  }

  private fun detachFromParent(child: View) {
    val parent = child.parent as? ViewGroup ?: return
    if (parent === this) {
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
  private fun detachOwnChildren(): List<View> {
    val list = ArrayList<View>(ownChildren.size)
    for (child in ownChildren) {
      if (!list.contains(child)) {
        list.add(child)
      }
    }
    ownChildren.clear()
    for (child in list) {
      detachFromParent(child)
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

  override fun onLayout(
    changed: Boolean,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
  ) {
    super.onLayout(changed, left, top, right, bottom)
    updatePortalLayoutStateIfNeeded()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    updatePortalLayoutStateIfNeeded()
  }

  override fun onDetachedFromWindow() {
    resetPortalLayoutStateIfNeeded()
    super.onDetachedFromWindow()
  }

  // region Accessibility
  // Override to prevent accessibility from trying to include non-descendant children
  override fun addChildrenForAccessibility(outChildren: ArrayList<View>) {
    if (!isTeleported()) {
      super.addChildrenForAccessibility(outChildren)
    }
    // When teleported, do nothing—children are handled by the host's accessibility tree
  }
  // endregion

  private data class HostLayoutState(
    val width: Float,
    val height: Float,
    val offsetX: Float,
    val offsetY: Float,
    val hasHostLayout: Boolean,
  ) {
    fun nearlyEquals(other: HostLayoutState): Boolean =
      hasHostLayout == other.hasHostLayout &&
        abs(width - other.width) < STATE_EPSILON &&
        abs(height - other.height) < STATE_EPSILON &&
        abs(offsetX - other.offsetX) < STATE_EPSILON &&
        abs(offsetY - other.offsetY) < STATE_EPSILON

    fun toMap() =
      Arguments.createMap().apply {
        putDouble("width", width.toDouble())
        putDouble("height", height.toDouble())
        putDouble("offsetX", offsetX.toDouble())
        putDouble("offsetY", offsetY.toDouble())
        putBoolean("hasHostLayout", hasHostLayout)
      }

    companion object {
      val EMPTY =
        HostLayoutState(
          width = 0f,
          height = 0f,
          offsetX = 0f,
          offsetY = 0f,
          hasHostLayout = false,
        )
    }
  }

  companion object {
    private const val STATE_EPSILON = 0.01f
  }
}
