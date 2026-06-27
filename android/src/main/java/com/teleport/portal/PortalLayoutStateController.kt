package com.teleport.portal

import android.view.View
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.StateWrapper
import com.teleport.host.PortalHostView
import kotlin.math.abs

internal class PortalLayoutStateController(
  private val sourceView: View,
) {
  private var lastHostLayout: HostLayoutState? = null
  private var stateWrapper: StateWrapper? = null

  fun setStateWrapper(wrapper: StateWrapper?) {
    stateWrapper = wrapper
  }

  fun updateIfNeeded(
    hostName: String?,
    host: PortalHostView?,
  ) {
    val wrapper = stateWrapper
    val shouldReset = shouldReset(hostName, host)

    when {
      wrapper == null -> Unit
      shouldReset -> resetIfNeeded()
      host == null || !hasMeasuredSize(host) -> Unit
      else -> publishIfChanged(wrapper, createHostLayoutState(host))
    }
  }

  fun resetIfNeeded() {
    val wrapper = stateWrapper
    val needsReset = wrapper != null && lastHostLayout?.hasHostLayout != false

    if (needsReset) {
      lastHostLayout = HostLayoutState.EMPTY
      wrapper?.updateState(HostLayoutState.EMPTY.toMap())
    }
  }

  private fun shouldReset(
    hostName: String?,
    host: PortalHostView?,
  ): Boolean = hostName == null || host == null || viewsAreDetached(host)

  private fun viewsAreDetached(host: PortalHostView): Boolean =
    !sourceView.isAttachedToWindow || !host.isAttachedToWindow

  private fun hasMeasuredSize(host: PortalHostView): Boolean = host.width != 0 && host.height != 0

  private fun publishIfChanged(
    wrapper: StateWrapper,
    nextState: HostLayoutState,
  ) {
    if (lastHostLayout?.nearlyEquals(nextState) != true) {
      lastHostLayout = nextState
      wrapper.updateState(nextState.toMap())
    }
  }

  private fun createHostLayoutState(host: PortalHostView): HostLayoutState {
    val sourceLocation = sourceView.screenLocation()
    val hostLocation = host.screenLocation()

    return HostLayoutState(
      width = PixelUtil.toDIPFromPixel(host.width.toFloat()),
      height = PixelUtil.toDIPFromPixel(host.height.toFloat()),
      offsetX = PixelUtil.toDIPFromPixel((hostLocation[0] - sourceLocation[0]).toFloat()),
      offsetY = PixelUtil.toDIPFromPixel((hostLocation[1] - sourceLocation[1]).toFloat()),
      hasHostLayout = true,
    )
  }
}

private data class HostLayoutState(
  val width: Float,
  val height: Float,
  val offsetX: Float,
  val offsetY: Float,
  val hasHostLayout: Boolean,
) {
  fun nearlyEquals(other: HostLayoutState): Boolean =
    hasHostLayout == other.hasHostLayout &&
      hasSameSize(other) &&
      hasSameOffset(other)

  private fun hasSameSize(other: HostLayoutState): Boolean =
    width.nearlyEquals(other.width) && height.nearlyEquals(other.height)

  private fun hasSameOffset(other: HostLayoutState): Boolean =
    offsetX.nearlyEquals(other.offsetX) && offsetY.nearlyEquals(other.offsetY)

  fun toMap() =
    Arguments.createMap().apply {
      putDouble("width", width.toDouble())
      putDouble("height", height.toDouble())
      putDouble("offsetX", offsetX.toDouble())
      putDouble("offsetY", offsetY.toDouble())
      putBoolean("hasHostLayout", hasHostLayout)
    }

  companion object {
    val EMPTY =
      HostLayoutState(
        width = 0f,
        height = 0f,
        offsetX = 0f,
        offsetY = 0f,
        hasHostLayout = false,
      )
  }
}

private fun View.screenLocation(): IntArray =
  IntArray(2).also {
    getLocationOnScreen(it)
  }

private fun Float.nearlyEquals(other: Float): Boolean = abs(this - other) < STATE_EPSILON

private const val STATE_EPSILON = 0.01f
