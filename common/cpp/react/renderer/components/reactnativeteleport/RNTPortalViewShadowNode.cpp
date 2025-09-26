#include "RNTPortalViewShadowNode.h"

namespace facebook::react {

extern const char PortalViewComponentName[] = "PortalView";

void PortalViewShadowNode::layout(facebook::react::LayoutContext layoutContext) {
  ConcreteViewShadowNode::layout(layoutContext);
  
  layoutMetrics_.frame.origin.x = 100;
  layoutMetrics_.frame.origin.y = 148;
  layoutMetrics_.frame.size.width = 200;
}

} // namespace facebook::react
