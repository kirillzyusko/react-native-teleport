package com.teleport.extensions

import android.content.res.Resources

internal val Float.dp: Double
  get() = (this / displayDensity).toDouble()

internal val Float.px: Double
  get() = (this * displayDensity).toDouble()

private val displayDensity: Float
  get() = Resources.getSystem().displayMetrics.density
