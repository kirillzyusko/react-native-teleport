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

  fun setName(newName: String?) {
    if (name == newName) return

    name?.let { PortalRegistry.unregisterHost(it, id) }
    name = newName
    newName?.let { PortalRegistry.registerHost(it, this) }
  }

  fun cleanup(viewId: Int) {
    name?.let { PortalRegistry.unregisterHost(it, viewId) }
  }

  /**
   * Adopt a child whose mParent reference is stuck pointing at a previous
   * (now-dropped) host. ViewGroup.addView refuses with IllegalStateException
   * ("child already has a parent") when child.getParent() != null, but the
   * protected ViewGroup.addViewInLayout sets `child.mParent = null` from
   * inside the framework before adding. That works regardless of how the
   * field is named in the running Android version (Android 16 renamed/
   * restricted it such that external reflection by literal name throws
   * NoSuchFieldException) and is the escape hatch for re-bind paths where
   * the previous host's standard removeView did not clear the child's
   * parent — which is the common case once Fabric has put the host into
   * the drop pipeline.
   *
   * The previous host's mChildren array may briefly still reference the
   * child until that host is GC'd, but it has been removed from the window
   * and is not drawing — so the inconsistency is harmless.
   */
  internal fun forceAdoptStuckView(
    child: View,
    index: Int,
  ) {
    val params =
      child.layoutParams ?: ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      )
    val safeIndex = minOf(index, childCount)
    addViewInLayout(child, safeIndex, params, false)
    requestLayout()
    invalidate()
  }
}
