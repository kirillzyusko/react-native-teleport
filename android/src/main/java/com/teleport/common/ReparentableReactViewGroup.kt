package com.teleport.common

import android.content.Context
import android.view.View
import com.facebook.react.views.view.ReactViewGroup

abstract class ReparentableReactViewGroup(
  context: Context?,
) : ReactViewGroup(context) {
  internal fun detachForReparent(child: View) {
    val index = indexOfChild(child)
    // detachViewFromParent() skips removeView()'s disappearing-view cleanup.
    // End the transition first so the fast path does not retain the old parent.
    endViewTransition(child)

    if (child.hasTransientState()) {
      childHasTransientStateChanged(child, false)
    }
    super.detachViewFromParent(child)
    // Nested screens can start multiple transitions for the same child. Each
    // endViewTransition() removes only one entry, so a detach can retain mParent.
    // Restore array membership before retrying, without detaching from the window.
    while (child.parent === this) {
      super.attachViewToParent(child, index, child.layoutParams)
      endViewTransition(child)
      super.detachViewFromParent(child)
    }
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
