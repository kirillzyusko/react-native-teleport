package com.teleport.host

import android.content.Context
import android.os.Handler
import android.os.Looper
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
    name = null
    isInBatch = false
    batchBaseIndex = 0
  }
}
