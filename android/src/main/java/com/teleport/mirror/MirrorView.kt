package com.teleport.mirror

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.RenderNode
import android.os.Build
import android.os.Choreographer
import android.view.View
import android.widget.ImageView
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.global.MirrorViewCallback
import com.teleport.global.PortalRegistry

class MirrorView(
  context: Context,
) : ReactViewGroup(context),
  MirrorViewCallback {
  private var portalName: String? = null
  private var mode: String = "layer"
  private var isWaitingForPortal = false
  private var isCapturing = false
  private var hasCaptured = false

  // Software path (layer/snapshot on API < 29, layer/snapshot always)
  private var imageView: ImageView? = null

  // RenderNode path (live mode on API 29+)
  private var mirrorRenderNode: RenderNode? = null
  private var useRenderNode = false

  private val frameCallback =
    object : Choreographer.FrameCallback {
      override fun doFrame(frameTimeNanos: Long) {
        if (!isCapturing) return

        when (mode) {
          "live" -> {
            captureFrame()
            Choreographer.getInstance().postFrameCallback(this)
          }
          "snapshot", "layer" -> {
            if (!hasCaptured) {
              val success = captureFrame()
              if (success) {
                hasCaptured = true
                isCapturing = false
              } else {
                Choreographer.getInstance().postFrameCallback(this)
              }
            }
          }
        }
      }
    }

  override fun onLayout(
    changed: Boolean,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
  ) {
    super.onLayout(changed, left, top, right, bottom)
    imageView?.layout(0, 0, right - left, bottom - top)
  }

  fun setPortalName(name: String?) {
    if (portalName == name) return

    teardown()

    if (isWaitingForPortal && portalName != null) {
      PortalRegistry.unregisterPendingMirror(portalName!!, this)
      isWaitingForPortal = false
    }

    portalName = name
    hasCaptured = false

    if (portalName != null) {
      val portal = PortalRegistry.getPortal(portalName)
      if (portal != null) {
        setup()
      } else {
        PortalRegistry.registerPendingMirror(portalName!!, this)
        isWaitingForPortal = true
      }
    }
  }

  fun setMode(newMode: String?) {
    val resolvedMode = newMode ?: "layer"
    if (mode == resolvedMode) return

    teardown()
    mode = resolvedMode
    hasCaptured = false

    if (portalName != null && PortalRegistry.getPortal(portalName) != null) {
      setup()
    }
  }

  override fun onPortalAvailable() {
    isWaitingForPortal = false
    setup()
  }

  private fun setup() {
    useRenderNode = mode == "live" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    if (useRenderNode) {
      setupRenderNode()
    } else {
      ensureImageView()
    }
    startCapturing()
  }

  private fun teardown() {
    stopCapturing()
    imageView?.let {
      it.setImageBitmap(null)
      removeView(it)
    }
    imageView = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      mirrorRenderNode?.discardDisplayList()
    }
    mirrorRenderNode = null
    useRenderNode = false
  }

  private fun setupRenderNode() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      mirrorRenderNode = RenderNode("MirrorView").apply {
        setPosition(0, 0, width, height)
      }
      // Enable hardware layer so dispatchDraw can use drawRenderNode
      setWillNotDraw(false)
    }
  }

  private fun ensureImageView() {
    if (imageView == null) {
      imageView =
        ImageView(context).apply {
          scaleType = ImageView.ScaleType.FIT_XY
        }
      addView(imageView)
      imageView?.layout(0, 0, width, height)
    }
  }

  private fun startCapturing() {
    isCapturing = true
    hasCaptured = false
    Choreographer.getInstance().postFrameCallback(frameCallback)
  }

  private fun stopCapturing() {
    isCapturing = false
    Choreographer.getInstance().removeFrameCallback(frameCallback)
  }

  private fun captureFrame(): Boolean {
    return if (useRenderNode && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      captureWithRenderNode()
    } else {
      captureWithBitmap()
    }
  }

  /**
   * RenderNode path: records drawing commands into a GPU display list.
   * Replay via drawRenderNode is hardware-accelerated — no Bitmap allocation,
   * no software rendering.
   */
  private fun captureWithRenderNode(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false

    val portal = PortalRegistry.getPortal(portalName) ?: return false
    val target = portal.getTargetView()

    val w = target.width
    val h = target.height
    if (w == 0 || h == 0) return false

    val node = mirrorRenderNode ?: return false
    node.setPosition(0, 0, this.width, this.height)

    val canvas = node.beginRecording(w, h)
    target.draw(canvas)
    node.endRecording()

    invalidate()
    return true
  }

  override fun dispatchDraw(canvas: Canvas) {
    super.dispatchDraw(canvas)

    if (useRenderNode && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val node = mirrorRenderNode
      if (node != null && node.hasDisplayList()) {
        val sourceW = node.width.toFloat()
        val sourceH = node.height.toFloat()
        if (sourceW > 0 && sourceH > 0) {
          canvas.save()
          canvas.scale(width.toFloat() / sourceW, height.toFloat() / sourceH)
          canvas.drawRenderNode(node)
          canvas.restore()
        }
      }
    }
  }

  /**
   * Bitmap path: software render into a Bitmap, displayed via ImageView.
   * Used for snapshot/layer modes, and as fallback for live on API < 29.
   */
  private fun captureWithBitmap(): Boolean {
    val portal = PortalRegistry.getPortal(portalName) ?: return false
    val target = portal.getTargetView()

    val w = target.width
    val h = target.height
    if (w == 0 || h == 0) return false

    val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val bitmapCanvas = Canvas(bitmap)
    target.draw(bitmapCanvas)

    imageView?.setImageBitmap(bitmap)
    return true
  }

  fun cleanup() {
    teardown()

    if (isWaitingForPortal && portalName != null) {
      PortalRegistry.unregisterPendingMirror(portalName!!, this)
      isWaitingForPortal = false
    }

    portalName = null
  }
}
