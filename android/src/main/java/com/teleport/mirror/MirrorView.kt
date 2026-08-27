package com.teleport.mirror

import android.content.Context
import android.graphics.Canvas
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.global.PortalRegistry

class MirrorView(
  context: Context,
) : ReactViewGroup(context) {
  private var name: String? = null
  private var sourceView: View? = null
  private var sourcePreDrawListener: ViewTreeObserver.OnPreDrawListener? = null

  init {
    setWillNotDraw(false)
  }

  fun setName(newName: String?) {
    if (newName == name) return

    name?.let { PortalRegistry.unregisterPendingMirror(it, this) }
    name = newName
    newName?.let { PortalRegistry.registerPendingMirror(it, this) }
    updateSource()
  }

  internal fun onSourceChanged() {
    updateSource()
  }

  fun cleanup() {
    name?.let { PortalRegistry.unregisterPendingMirror(it, this) }
    name = null
    attachSource(null)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    updateSource()
  }

  override fun onDetachedFromWindow() {
    attachSource(null)
    super.onDetachedFromWindow()
  }

  override fun dispatchDraw(canvas: Canvas) {
    drawSource(canvas)
    super.dispatchDraw(canvas)
  }

  private fun updateSource() {
    attachSource(PortalRegistry.getPortalSource(name))
  }

  private fun attachSource(source: View?) {
    if (sourceView == source) {
      invalidate()
      return
    }

    detachSourceListeners()
    sourceView = source
    source?.let { attachSourceListener(it) }
    invalidate()
  }

  private fun attachSourceListener(source: View) {
    val listener =
      ViewTreeObserver.OnPreDrawListener {
        invalidate()
        true
      }
    sourcePreDrawListener = listener
    source.viewTreeObserver.addOnPreDrawListener(listener)
  }

  private fun detachSourceListeners() {
    val source = sourceView
    val listener = sourcePreDrawListener
    if (source != null) {
      if (listener != null && source.viewTreeObserver.isAlive) {
        source.viewTreeObserver.removeOnPreDrawListener(listener)
      }
    }
    sourcePreDrawListener = null
  }

  private fun drawSource(canvas: Canvas) {
    val source = sourceView ?: return
    if (source === this || source.width <= 0 || source.height <= 0 || width <= 0 || height <= 0) {
      return
    }
    if (containsSurfaceView(source)) return

    val saveCount = canvas.save()
    try {
      canvas.scale(width.toFloat() / source.width, height.toFloat() / source.height)
      source.draw(canvas)
    } finally {
      canvas.restoreToCount(saveCount)
    }
  }

  private fun containsSurfaceView(view: View): Boolean {
    if (view is SurfaceView) return true
    if (view !is ViewGroup) return false

    for (index in 0 until view.childCount) {
      if (containsSurfaceView(view.getChildAt(index))) return true
    }
    return false
  }
}
