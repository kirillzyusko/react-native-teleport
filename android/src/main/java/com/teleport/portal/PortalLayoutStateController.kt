package com.teleport.portal

import android.view.View
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.StateWrapper
import com.teleport.extensions.dp
import com.teleport.extensions.isDetached
import com.teleport.extensions.screenLocation
import com.teleport.host.PortalHostView

internal class PortalLayoutStateController(
  private val sourceView: View,
) {
  private var lastLayout = PortalLayoutState.EMPTY
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
      else -> publishIfChanged(wrapper, createLayoutState(activeHost))
    }
  }

  fun resetIfNeeded() {
    val wrapper = stateWrapper

    if (wrapper != null) {
      publishIfChanged(wrapper, PortalLayoutState.EMPTY)
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
    nextLayout: PortalLayoutState,
  ) {
    if (lastLayout != nextLayout) {
      lastLayout = nextLayout
      wrapper.updateState(nextLayout.toMap())
    }
  }

  private fun createLayoutState(host: PortalHostView): PortalLayoutState {
    val sourceLocation = sourceView.screenLocation()
    val hostLocation = host.screenLocation()

    return PortalLayoutState(
      hostWidth = host.width.toFloat().dp,
      hostHeight = host.height.toFloat().dp,
      offsetX = (hostLocation[0] - sourceLocation[0]).toFloat().dp,
      offsetY = (hostLocation[1] - sourceLocation[1]).toFloat().dp,
    )
  }
}

private data class PortalLayoutState(
  val hostWidth: Double,
  val hostHeight: Double,
  val offsetX: Double,
  val offsetY: Double,
) {
  fun toMap() =
    Arguments.createMap().apply {
      putDouble("hostWidth", hostWidth)
      putDouble("hostHeight", hostHeight)
      putDouble("offsetX", offsetX)
      putDouble("offsetY", offsetY)
    }

  companion object {
    val EMPTY =
      PortalLayoutState(
        hostWidth = 0.0,
        hostHeight = 0.0,
        offsetX = 0.0,
        offsetY = 0.0,
      )
  }
}
