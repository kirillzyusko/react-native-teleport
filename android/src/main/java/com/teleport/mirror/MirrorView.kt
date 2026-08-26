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
  private var renderedSourceName: String? = null
  private var sourceView: View? = null
  private var renderNodeRecorder: RenderNodeRecorder? = null
  private var bitmapRecorder: BitmapRecorder? = null
  private var sourcePreDrawListener: ViewTreeObserver.OnPreDrawListener? = null
  private var isRecordingSource = false
  private var sourceRefreshGeneration = 0
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

    if (newName == null) {
      clearSourceAndFrame()
    } else {
      val source = PortalRegistry.getPortalSource(newName)
      if (source != null && source.isDrawableSource()) {
        attachSource(source, newName)
      } else {
        scheduleSourceRefresh(newName)
      }
    }
  }

  internal fun onSourceChanged() {
    val requestedName = name ?: return
    val source = PortalRegistry.getPortalSource(requestedName)

    if (source != null && source.isDrawableSource()) {
      attachSource(source, requestedName)
    } else if (renderedSourceName == requestedName) {
      // Fabric can unregister and register a same-name Portal in one commit.
      // Keep the last recorded pixels until the next frame so that ordering
      // cannot expose a blank Mirror between those two mutations.
      scheduleSourceRefresh(requestedName)
    }
  }

  fun cleanup() {
    name?.let { PortalRegistry.unregisterPendingMirror(it, this) }
    name = null
    clearSourceAndFrame()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    val requestedName = name
    val source = requestedName?.let { PortalRegistry.getPortalSource(it) }
    if (requestedName != null && source != null && source.isDrawableSource()) {
      attachSource(source, requestedName)
    }
  }

  override fun onDetachedFromWindow() {
    clearSourceAndFrame()
    super.onDetachedFromWindow()
  }

  override fun dispatchDraw(canvas: Canvas) {
    drawSource(canvas)
    super.dispatchDraw(canvas)
  }

  private fun attachSource(
    source: View,
    sourceName: String,
  ) {
    sourceRefreshGeneration += 1
    if (sourceView == source && renderedSourceName == sourceName) {
      invalidate()
      return
    }

    detachSourceListeners()
    sourceView = source
    renderedSourceName = sourceName
    attachSourceListeners(source)
    invalidate()
  }

  private fun detachSourceKeepingFrame() {
    detachSourceListeners()
    sourceView = null
    invalidate()
  }

  private fun scheduleSourceRefresh(requestedName: String) {
    sourceRefreshGeneration += 1
    val generation = sourceRefreshGeneration
    detachSourceKeepingFrame()

    postOnAnimation {
      if (generation != sourceRefreshGeneration || name != requestedName) {
        return@postOnAnimation
      }

      val replacement = PortalRegistry.getPortalSource(requestedName)
      if (replacement != null && replacement.isDrawableSource()) {
        attachSource(replacement, requestedName)
      } else {
        clearSourceAndFrame()
      }
    }
  }

  private fun clearSourceAndFrame() {
    sourceRefreshGeneration += 1
    detachSourceKeepingFrame()
    renderedSourceName = null
    renderNodeRecorder?.clear()
    renderNodeRecorder = null
    bitmapRecorder?.clear()
    bitmapRecorder = null
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
    if (isRecordingSource || width <= 0 || height <= 0) {
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && canvas.isHardwareAccelerated) {
      val recorder = renderNodeRecorder ?: RenderNodeRecorder().also { renderNodeRecorder = it }
      recordCurrentSource(recorder::record)
      if (!recorder.hasFrame) return

      val saveCount = canvas.save()
      canvas.scale(width.toFloat() / recorder.width, height.toFloat() / recorder.height)
      recorder.draw(canvas)
      canvas.restoreToCount(saveCount)
    } else {
      val recorder = bitmapRecorder ?: BitmapRecorder().also { bitmapRecorder = it }
      recordCurrentSource(recorder::record)
      if (!recorder.hasFrame) return

      val saveCount = canvas.save()
      canvas.scale(width.toFloat() / recorder.width, height.toFloat() / recorder.height)
      recorder.draw(canvas)
      canvas.restoreToCount(saveCount)
    }
  }

  private inline fun recordCurrentSource(record: (View) -> Unit) {
    val source = sourceView ?: return
    if (!source.isDrawableSource()) return

    isRecordingSource = true
    try {
      record(source)
    } finally {
      isRecordingSource = false
    }
  }

  private fun View.isDrawableSource(): Boolean =
    this !== this@MirrorView && width > 0 && height > 0

  private class RenderNodeRecorder {
    private val renderNode = RenderNode("TeleportMirror")
    var width: Int = 0
      private set
    var height: Int = 0
      private set
    val hasFrame: Boolean
      get() = width > 0 && height > 0 && renderNode.hasDisplayList()

    fun record(source: View) {
      renderNode.setPosition(0, 0, source.width, source.height)
      val recordingCanvas = renderNode.beginRecording(source.width, source.height)
      try {
        source.draw(recordingCanvas)
      } finally {
        renderNode.endRecording()
      }
      width = source.width
      height = source.height
    }

    fun draw(canvas: Canvas) {
      if (renderNode.hasDisplayList()) {
        canvas.drawRenderNode(renderNode)
      }
    }

    fun clear() {
      renderNode.discardDisplayList()
      width = 0
      height = 0
    }
  }

  private class BitmapRecorder {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private var bitmap: Bitmap? = null
    val width: Int
      get() = bitmap?.width ?: 0
    val height: Int
      get() = bitmap?.height ?: 0
    val hasFrame: Boolean
      get() = bitmap != null

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

    fun clear() {
      bitmap?.recycle()
      bitmap = null
    }
  }
}
