package com.teleport.reparent

import android.os.Looper
import android.view.SurfaceView
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import com.teleport.host.PortalHostView
import com.teleport.portal.PortalView

/**
 * Proof-of-concept reparenting path for surface-backed subtrees.
 *
 * [ViewGroup.detachViewFromParent] and [ViewGroup.attachViewToParent] mutate the
 * child arrays without dispatching onDetachedFromWindow/onAttachedToWindow.
 * This lets a SurfaceView or TextureView keep its producer surface while it is
 * moved between two parents in the same attached window.
 *
 * These APIs are deliberately lightweight, so this path is restricted to the
 * case required for surface continuity. Ordinary Teleport moves keep using
 * removeView/addView.
 */
internal object AttachedSurfaceReparenter {
  fun tryReparent(
    child: View,
    target: ViewGroup,
    targetIndex: Int,
  ): Boolean {
    val source = child.parent as? ViewGroup ?: return false

    if (source === target || !containsSurfaceBackedView(child)) return false
    if (!supportsAttachedReparent(source) || !supportsAttachedReparent(target)) return false
    if (Looper.myLooper() !== Looper.getMainLooper()) return false
    if (!source.isAttachedToWindow || !target.isAttachedToWindow || !child.isAttachedToWindow) {
      return false
    }
    if (source.rootView !== target.rootView) return false

    val sourceWindowToken = source.windowToken ?: return false
    if (sourceWindowToken != target.windowToken) return false

    // Focus transfer has more cross-parent bookkeeping than this PoC handles.
    // Transient-state bookkeeping is transferred by the parent hooks below.
    if (child.hasFocus()) return false
    if (source.layoutTransition != null || target.layoutTransition != null) return false

    val sourceIndex = physicalIndexOfChild(source, child)
    if (sourceIndex < 0) return false

    val params = child.layoutParams ?: return false
    val safeTargetIndex = targetIndex.coerceIn(0, physicalChildCount(target))

    child.dispatchStartTemporaryDetach()
    try {
      detachChild(source, child)
      try {
        attachChild(target, child, safeTargetIndex, params)
      } catch (error: Throwable) {
        // A failed attach must not leave a still-window-attached view parentless.
        if (child.parent === target) {
          detachChild(target, child)
        }
        if (child.parent == null) {
          attachChild(source, child, sourceIndex.coerceAtMost(physicalChildCount(source)), params)
        }
        throw error
      }
    } finally {
      child.dispatchFinishTemporaryDetach()
    }

    return true
  }

  private fun supportsAttachedReparent(parent: ViewGroup): Boolean =
    parent is PortalView || parent is PortalHostView

  private fun physicalIndexOfChild(
    parent: ViewGroup,
    child: View,
  ): Int =
    when (parent) {
      is PortalView -> parent.physicalIndexOfChild(child)
      is PortalHostView -> parent.physicalIndexOfChild(child)
      else -> -1
    }

  private fun physicalChildCount(parent: ViewGroup): Int =
    when (parent) {
      is PortalView -> parent.physicalChildCount()
      is PortalHostView -> parent.physicalChildCount()
      else -> 0
    }

  private fun detachChild(
    parent: ViewGroup,
    child: View,
  ) {
    when (parent) {
      is PortalView -> parent.detachChildForAttachedReparent(child)
      is PortalHostView -> parent.detachChildForAttachedReparent(child)
      else -> error("Unsupported attached-reparent source: ${parent.javaClass.name}")
    }
  }

  private fun attachChild(
    parent: ViewGroup,
    child: View,
    index: Int,
    params: ViewGroup.LayoutParams,
  ) {
    when (parent) {
      is PortalView -> parent.attachChildForAttachedReparent(child, index, params)
      is PortalHostView -> parent.attachChildForAttachedReparent(child, index, params)
      else -> error("Unsupported attached-reparent target: ${parent.javaClass.name}")
    }
  }

  private fun containsSurfaceBackedView(view: View): Boolean {
    if (view is SurfaceView || view is TextureView) return true
    if (view !is ViewGroup) return false

    for (index in 0 until view.childCount) {
      if (containsSurfaceBackedView(view.getChildAt(index))) return true
    }
    return false
  }
}
