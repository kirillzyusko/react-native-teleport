package com.teleport.portal

import android.view.View
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.StateWrapper
import com.teleport.extensions.isDetached
import com.teleport.extensions.screenLocation
import com.teleport.host.PortalHostView

internal class PortalLayoutStateController(
  private val sourceView: View,
) {
  private var lastOffset = PortalOffsetState.EMPTY
  private var stateWrapper: StateWrapper? = null

  fun setStateWrapper(wrapper: StateWrapper?) {
    stateWrapper = wrapper
  }

  fun updateIfNeeded(
    hostName: String?,
    host: PortalHostView?,
  ) {
    val wrapper = stateWrapper
    val activeHost = activeHost(hostName, host)

    when {
      wrapper == null -> Unit
      activeHost == null -> resetIfNeeded()
      else -> publishIfChanged(wrapper, createOffsetState(activeHost))
    }
  }

  fun resetIfNeeded() {
    val wrapper = stateWrapper

    if (wrapper != null) {
      publishIfChanged(wrapper, PortalOffsetState.EMPTY)
    }
  }

  private fun activeHost(
    hostName: String?,
    host: PortalHostView?,
  ): PortalHostView? =
    if (hostName == null || host == null || viewsAreDetached(host)) {
      null
    } else {
      host
    }

  private fun viewsAreDetached(host: PortalHostView): Boolean = sourceView.isDetached() || host.isDetached()

  private fun publishIfChanged(
    wrapper: StateWrapper,
    nextOffset: PortalOffsetState,
  ) {
    if (lastOffset != nextOffset) {
      lastOffset = nextOffset
      wrapper.updateState(nextOffset.toMap())
    }
  }

  private fun createOffsetState(host: PortalHostView): PortalOffsetState {
    val sourceLocation = sourceView.screenLocation()
    val hostLocation = host.screenLocation()

    return PortalOffsetState(
      offsetX = PixelUtil.toDIPFromPixel((hostLocation[0] - sourceLocation[0]).toFloat()),
      offsetY = PixelUtil.toDIPFromPixel((hostLocation[1] - sourceLocation[1]).toFloat()),
    )
  }
}

private data class PortalOffsetState(
  val offsetX: Float,
  val offsetY: Float,
) {
  fun toMap() =
    Arguments.createMap().apply {
      putDouble("offsetX", offsetX.toDouble())
      putDouble("offsetY", offsetY.toDouble())
    }

  companion object {
    val EMPTY =
      PortalOffsetState(
        offsetX = 0f,
        offsetY = 0f,
      )
  }
}
