package com.teleport.common

import android.content.Context
import android.view.View
import com.facebook.react.views.view.ReactViewGroup

abstract class ReparentableReactViewGroup(
  context: Context?,
) : ReactViewGroup(context) {
  internal fun detachForReparent(child: View) {
    if (child.hasTransientState()) {
      childHasTransientStateChanged(child, false)
    }
    super.detachViewFromParent(child)
    // attach/detachViewFromParent deliberately skip ViewGroup callbacks. Keep
    // ReactViewGroup's drawing-order bookkeeping in sync explicitly.
    onViewRemoved(child)
    invalidate()
  }

  protected fun attachDetachedView(
    child: View,
    index: Int,
  ) {
    super.attachViewToParent(child, index, child.layoutParams)
    onViewAdded(child)
    if (child.hasTransientState()) {
      childHasTransientStateChanged(child, true)
    }
    invalidate()
  }
}
