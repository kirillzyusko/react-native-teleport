#pragma once

#include "RNTPortalViewState.h"
#include "PortalShadowRegistry.h"

#include <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/core/LayoutContext.h>
#include <jsi/jsi.h>

namespace facebook::react {

JSI_EXPORT extern const char PortalViewComponentName[];

/*
 * `ShadowNode` for <PortalView> component.
 */
class PortalViewShadowNode final : public ConcreteViewShadowNode<
      PortalViewComponentName,
      PortalViewProps,
      PortalViewEventEmitter,
      PortalViewState>, public std::enable_shared_from_this<PortalViewShadowNode> {
 public:
  using ConcreteViewShadowNode::ConcreteViewShadowNode;

  void appendChild(const std::shared_ptr<const ShadowNode> &child) override;
  void layout(LayoutContext layoutContext) override;
};

} // namespace facebook::react
