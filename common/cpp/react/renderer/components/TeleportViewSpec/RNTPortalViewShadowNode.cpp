#include "RNTPortalViewShadowNode.h"

namespace facebook::react {

extern const char PortalViewComponentName[] = "PortalView";

void PortalViewShadowNode::layout(facebook::react::LayoutContext layoutContext) {
  ConcreteViewShadowNode::layout(layoutContext);

  printf("PortalViewShadowNode::layout");

  // layoutMetrics_.frame.origin.x = 100;
  // layoutMetrics_.frame.origin.y = 148;
  // layoutMetrics_.frame.size.width = 200;
}

void PortalViewShadowNode::appendChild(
                                       const std::shared_ptr<const ShadowNode> &child) {
  // printf("PortalViewShadowNode::appendChild: child=%p\n", child.get());
  YogaLayoutableShadowNode::appendChild(child);
}

} // namespace facebook::react
