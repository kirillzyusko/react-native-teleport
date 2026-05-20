package com.teleport.mirror

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.RenderNode
import android.os.Build
import android.view.View
import android.view.ViewTreeObserver
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.global.PortalRegistry

class MirrorView(
  context: Context,
) : ReactViewGroup(context) {
  private var name: String? = null
  private var sourceView: View? = null
  private var renderNodeRecorder: RenderNodeRecorder? = null
  private var bitmapRecorder: BitmapRecorder? = null
  private var sourcePreDrawListener: ViewTreeObserver.OnPreDrawListener? = null
  private val sourceLayoutListener =
    View.OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> invalidate() }

  init {
    setWillNotDraw(false)
  }

  fun setName(newName: String?) {
    if (newName == name) return

    name?.let { PortalRegistry.unregisterPendingMirror(it, this) }
    name = newName
    newName?.let { PortalRegistry.registerPendingMirror(it, this) }
    attachSource(newName?.let { PortalRegistry.getPortalSource(it) })
  }

  fun setHidesSourceView(@Suppress("UNUSED_PARAMETER") hidesSourceView: Boolean) {
    // RenderNode replay still needs the source view to render normally.
  }

  fun setMatchesAlpha(@Suppress("UNUSED_PARAMETER") matchesAlpha: Boolean) {
    invalidate()
  }

  fun setMatchesTransform(@Suppress("UNUSED_PARAMETER") matchesTransform: Boolean) {
    invalidate()
  }

  fun setMatchesPosition(@Suppress("UNUSED_PARAMETER") matchesPosition: Boolean) {
    invalidate()
  }

  internal fun onSourceChanged() {
    attachSource(name?.let { PortalRegistry.getPortalSource(it) })
  }

  fun cleanup() {
    name?.let { PortalRegistry.unregisterPendingMirror(it, this) }
    name = null
    attachSource(null)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attachSource(name?.let { PortalRegistry.getPortalSource(it) })
  }

  override fun onDetachedFromWindow() {
    attachSource(null)
    super.onDetachedFromWindow()
  }

  override fun dispatchDraw(canvas: Canvas) {
    drawSource(canvas)
    super.dispatchDraw(canvas)
  }

  private fun attachSource(source: View?) {
    if (sourceView == source) {
      invalidate()
      return
    }

    detachSourceListeners()
    sourceView = source
    source?.let { attachSourceListeners(it) }
    invalidate()
  }

  private fun attachSourceListeners(source: View) {
    source.addOnLayoutChangeListener(sourceLayoutListener)
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
      source.removeOnLayoutChangeListener(sourceLayoutListener)
      if (listener != null && source.viewTreeObserver.isAlive) {
        source.viewTreeObserver.removeOnPreDrawListener(listener)
      }
    }
    sourcePreDrawListener = null
  }

  private fun drawSource(canvas: Canvas) {
    val source = sourceView ?: return
    if (source == this || source.width <= 0 || source.height <= 0 || width <= 0 || height <= 0) {
      return
    }

    val saveCount = canvas.save()
    canvas.scale(width.toFloat() / source.width, height.toFloat() / source.height)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && canvas.isHardwareAccelerated) {
      val recorder = renderNodeRecorder ?: RenderNodeRecorder().also { renderNodeRecorder = it }
      recorder.record(source)
      recorder.draw(canvas)
    } else {
      val recorder = bitmapRecorder ?: BitmapRecorder().also { bitmapRecorder = it }
      recorder.record(source)
      recorder.draw(canvas)
    }

    canvas.restoreToCount(saveCount)
  }

  private class RenderNodeRecorder {
    private val renderNode = RenderNode("TeleportMirror")

    fun record(source: View) {
      renderNode.setPosition(0, 0, source.width, source.height)
      val recordingCanvas = renderNode.beginRecording(source.width, source.height)
      try {
        source.draw(recordingCanvas)
      } finally {
        renderNode.endRecording()
      }
    }

    fun draw(canvas: Canvas) {
      if (renderNode.hasDisplayList()) {
        canvas.drawRenderNode(renderNode)
      }
    }
  }

  private class BitmapRecorder {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private var bitmap: Bitmap? = null

    fun record(source: View) {
      val current = bitmap
      val next =
        if (current == null || current.width != source.width || current.height != source.height) {
          current?.recycle()
          Bitmap.createBitmap(source.width, source.height, Bitmap.Config.ARGB_8888)
        } else {
          current
        }

      bitmap = next
      val bitmapCanvas = Canvas(next)
      bitmapCanvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)
      source.draw(bitmapCanvas)
    }

    fun draw(canvas: Canvas) {
      bitmap?.let { canvas.drawBitmap(it, 0f, 0f, paint) }
    }
  }
}
