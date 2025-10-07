#include "PortalShadowRegistry.h"

namespace facebook::react {

  extern const char PortalHostViewComponentName[] = "PortalHostView";

void PortalHostViewShadowNode::appendChild(
                                       const std::shared_ptr<const ShadowNode> &child) {
  // std::shared_ptr<PortalViewShadowNode> portal = PortalShadowRegistry::shared().getPortal("overlay");
  // if (portal.get() != nullptr) {
  //  printf("portal is not empty - attaching to host");
  //  portal.get()->appendChild(child);
  // } else {
    printf("portal is empty - attaching to own container");
    YogaLayoutableShadowNode::appendChild(child);
  // }
}

} // namespace facebook::react
