package com.teleport.extensions

import android.view.View
import android.view.ViewGroup
import com.teleport.host.PortalHostView
import com.teleport.portal.PortalView

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
    (source is PortalView || source is PortalHostView) &&
    isAttachedToWindow &&
    target.isAttachedToWindow &&
    source.rootView === target.rootView &&
    !hasFocus() &&
    source.layoutTransition == null &&
    target.layoutTransition == null

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
