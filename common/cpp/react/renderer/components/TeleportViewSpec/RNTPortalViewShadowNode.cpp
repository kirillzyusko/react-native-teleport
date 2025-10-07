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
  printf("PortalViewShadowNode::appendChild: child=%p\n", child.get());
  // const auto* props =
        dynamic_cast<const PortalViewProps*>(child.get()->getProps().get());
  // std::string hostName = props ? props->hostName.c_str() : "";
  // std::shared_ptr<PortalHostViewShadowNode> host = PortalShadowRegistry::shared().getHost("overlay");
  // if (host.get() != nullptr) {
  //  printf("host is not empty - attaching to host");
    // TODO: will trigger a crash because of unsealed!!
    // host.get()->appendChild(child);
  // } else {
    printf("host is empty - attaching to own container");
    YogaLayoutableShadowNode::appendChild(child);
  // }
}

} // namespace facebook::react
