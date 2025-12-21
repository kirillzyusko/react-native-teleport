package com.teleport.util

import com.facebook.react.uimanager.PointerEvents
import com.facebook.react.views.view.ReactViewGroup

object PointerEventsCompat {
  fun set(view: ReactViewGroup, pe: PointerEvents) {
    view.setPointerEvents(pe)
  }
}
