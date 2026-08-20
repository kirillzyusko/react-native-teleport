package com.teleport.host

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.global.PortalRegistry

class PortalHostView(
  context: Context?,
) : ReactViewGroup(context) {
  private var name: String? = null
  private var isInBatch = false
  private var batchBaseIndex = 0
  private var pendingCleanupViewId: Int? = null

  // region ViewManager methods
  fun setName(newName: String?) {
    if (name == newName) return

    name?.let { PortalRegistry.unregisterHost(it, id) }
    name = newName
    newName?.let { PortalRegistry.registerHost(it, this) }
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
      batchBaseIndex = childCount
      Handler(Looper.getMainLooper()).post { isInBatch = false }
    }
    return minOf(batchBaseIndex + childIndex, childCount)
  }

  /** Internal hooks used by the same-window attached-reparent PoC. */
  internal fun physicalIndexOfChild(child: View): Int = super.indexOfChild(child)

  internal fun physicalChildCount(): Int = super.getChildCount()

  internal fun detachChildForAttachedReparent(child: View) {
    check(super.indexOfChild(child) >= 0) { "The view is not a physical child of this host" }
    if (child.hasTransientState()) {
      childHasTransientStateChanged(child, false)
    }
    super.detachViewFromParent(child)
    // attach/detachViewFromParent deliberately skip ViewGroup callbacks. Keep
    // ReactViewGroup's drawing-order bookkeeping in sync explicitly.
    onViewRemoved(child)
    requestLayout()
    invalidate()
  }

  internal fun attachChildForAttachedReparent(
    child: View,
    index: Int,
    params: ViewGroup.LayoutParams,
  ) {
    super.attachViewToParent(child, index, params)
    onViewAdded(child)
    if (child.hasTransientState()) {
      childHasTransientStateChanged(child, true)
    }
    requestLayout()
    invalidate()
  }
  // endregion

  // region Lifecycle
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
    super.onDetachedFromWindow()

    pendingCleanupViewId?.let { cleanupNow(it) }
  }
  // endregion

  // region Helpers
  private fun cleanupNow(viewId: Int) {
    name?.let { PortalRegistry.unregisterHost(it, viewId) }
    name = null
    isInBatch = false
    batchBaseIndex = 0
    pendingCleanupViewId = null
  }
  // endregion
}
