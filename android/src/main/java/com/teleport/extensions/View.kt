package com.teleport.extensions

import android.view.View

internal fun View.screenLocation(): IntArray =
  IntArray(2).also {
    getLocationOnScreen(it)
  }
