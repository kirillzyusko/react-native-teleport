package com.teleport.extensions

import android.view.View
import android.view.ViewGroup
import java.util.ArrayList

internal fun View.screenLocation(): IntArray =
  IntArray(2).also {
    getLocationOnScreen(it)
  }

internal fun View.isDetached(): Boolean = !isAttachedToWindow

internal fun View.canReparentAttached(
  source: ViewGroup,
  target: ViewGroup,
): Boolean =
  source !== target &&
    isAttachedToWindow &&
    target.isAttachedToWindow &&
    source.rootView === target.rootView &&
    !hasFocus() &&
    source.layoutTransition == null &&
    target.layoutTransition == null

/**
 * Ends transitions owned by every ViewGroup in this subtree.
 *
 * A transitioning child can keep its old parent after removeView(). When the
 * subtree is moved elsewhere, the original transition owner can no longer
 * reach that child to finish the transition and clear the stale parent.
 */
internal fun ViewGroup.endViewTransitionsRecursively() {
  val children = ArrayList<View>(childCount)
  for (i in 0 until childCount) {
    getChildAt(i)?.let { children.add(it) }
  }

  for (child in children) {
    endViewTransition(child)
    (child as? ViewGroup)?.endViewTransitionsRecursively()
  }
}

/**
 * Finds the host index of the first next sibling already present in the host.
 * Returns -1 when none is found (caller should append).
 */
internal fun List<View>.findNextSiblingHostIndex(
  host: ViewGroup,
  ownIndex: Int,
): Int {
  for (i in (ownIndex + 1) until size) {
    val siblingIndex = host.indexOfChild(this[i])
    if (siblingIndex >= 0) return siblingIndex
  }
  return -1
}
