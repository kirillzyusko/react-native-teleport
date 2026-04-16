#pragma once

#include "RNTMirrorViewState.h"

#include <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <jsi/jsi.h>

namespace facebook::react {

  JSI_EXPORT extern const char MirrorViewComponentName[];

  /*
   * `ShadowNode` for <MirrorView> component.
   */
  class MirrorViewShadowNode : public ConcreteViewShadowNode<
                                   MirrorViewComponentName,
                                   MirrorViewProps,
                                   MirrorViewEventEmitter,
                                   MirrorViewState> {
   public:
    using ConcreteViewShadowNode::ConcreteViewShadowNode;
  };

} // namespace facebook::react
