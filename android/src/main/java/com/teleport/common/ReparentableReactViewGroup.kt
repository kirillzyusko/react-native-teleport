package com.teleport.common

import android.content.Context
import android.view.View
import com.facebook.react.views.view.ReactViewGroup

abstract class ReparentableReactViewGroup(
  context: Context?,
) : ReactViewGroup(context) {
  internal fun detachForReparent(child: View) {
    logReparentPrimitive("detach", this, child, "before")
    if (child.hasTransientState()) {
      childHasTransientStateChanged(child, false)
    }
    super.detachViewFromParent(child)
    // attach/detachViewFromParent deliberately skip ViewGroup callbacks. Keep
    // ReactViewGroup's drawing-order bookkeeping in sync explicitly.
    onViewRemoved(child)
    invalidate()
    logReparentPrimitive("detach", this, child, "after")
  }

  protected fun attachDetachedView(
    child: View,
    index: Int,
  ) {
    logReparentPrimitive("attach", this, child, "before")
    super.attachViewToParent(child, index, child.layoutParams)
    onViewAdded(child)
    if (child.hasTransientState()) {
      childHasTransientStateChanged(child, true)
    }
    invalidate()
    logReparentPrimitive("attach", this, child, "after")
  }
}
