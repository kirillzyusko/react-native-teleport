package com.teleport.portal

import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.StateWrapper
import com.teleport.extensions.dp
import com.teleport.host.PortalHostView

internal class PortalLayoutStateController {
  private var lastLayout = PortalLayoutState.EMPTY
  private var stateWrapper: StateWrapper? = null

  fun setStateWrapper(wrapper: StateWrapper?) {
    stateWrapper = wrapper
  }

  fun updateIfNeeded(host: PortalHostView?) {
    val wrapper = stateWrapper ?: return

    publishIfChanged(wrapper, host?.let(::createLayoutState) ?: PortalLayoutState.EMPTY)
  }

  fun resetIfNeeded() = updateIfNeeded(null)

  private fun publishIfChanged(
    wrapper: StateWrapper,
    nextLayout: PortalLayoutState,
  ) {
    if (lastLayout != nextLayout) {
      lastLayout = nextLayout
      wrapper.updateState(nextLayout.toMap())
    }
  }

  // Children are physically mounted under the host, but laid out through the
  // PortalView shadow node. Publish the host they live in and its native size,
  // so Fabric can size and measure them against the destination.
  private fun createLayoutState(host: PortalHostView): PortalLayoutState =
    PortalLayoutState(
      hostWidth = host.width.toFloat().dp,
      hostHeight = host.height.toFloat().dp,
      hostTag = host.id,
    )
}

private data class PortalLayoutState(
  val hostWidth: Double,
  val hostHeight: Double,
  val hostTag: Int,
) {
  fun toMap() =
    Arguments.createMap().apply {
      putDouble("hostWidth", hostWidth)
      putDouble("hostHeight", hostHeight)
      putInt("hostTag", hostTag)
    }

  companion object {
    val EMPTY =
      PortalLayoutState(
        hostWidth = 0.0,
        hostHeight = 0.0,
        hostTag = 0,
      )
  }
}
