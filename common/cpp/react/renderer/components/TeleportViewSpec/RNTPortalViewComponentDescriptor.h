#pragma once

#include "RNTPortalViewShadowNode.h"
#include "PortalShadowRegistry.h"

#include <react/debug/react_native_assert.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {

class PortalViewComponentDescriptor final
    : public ConcreteComponentDescriptor<PortalViewShadowNode> {
 public:
  using ConcreteComponentDescriptor::ConcreteComponentDescriptor;
  void adopt(ShadowNode &shadowNode) const override {
    react_native_assert(dynamic_cast<PortalViewShadowNode *>(&shadowNode));

    // MARK: Register portal
    auto& portalShadowNode = static_cast<PortalViewShadowNode&>(shadowNode);
    auto name = std::static_pointer_cast<const PortalViewProps>(portalShadowNode.getProps())->hostName;

    if (!name.empty()) {
      auto sharedHost = portalShadowNode.shared_from_this();
      PortalShadowRegistry::shared().registerPortal(name, sharedHost);
    }
    
    
    auto& layoutablePortalShadowNode =
            static_cast<YogaLayoutableShadowNode&>(shadowNode);
    // layoutablePortalShadowNode.setSize(Size{
    //        .width = 200,
    //        .height = 200});

    const auto* props =
          dynamic_cast<const PortalViewProps*>(shadowNode.getProps().get());
    std::string hostName = props ? props->hostName.c_str() : "";

    //printf("PortalViewComponentDescriptor::adopt: name='%s'\n",
    //       &hostName);

    if (!hostName.empty()) {
      std::shared_ptr<PortalHostViewShadowNode> host = PortalShadowRegistry::shared().getHost(hostName);
      
      // host->dirtyLayout();
      
      // printf("  host=%p\n", host.get());
      auto *rawHostPtr = host.get();
      auto& layoutableHostShadowNode =
              static_cast<YogaLayoutableShadowNode&>(*rawHostPtr);

      auto *concretePtr = static_cast<YogaLayoutableShadowNode*>(&shadowNode);
      std::shared_ptr<YogaLayoutableShadowNode> layoutableShared(
           concretePtr,
           [](YogaLayoutableShadowNode*) {
             /* no-op deleter: do nothing on destruction */
           });
      
      auto flexGrowOpt = props->yogaStyle.flexGrow();
      float flexValue = flexGrowOpt.isUndefined() ? 0.0f : flexGrowOpt.unwrap();
      
      // YGValue flexValue = props->yogaStyle.flexGrow();

      // layoutableHostShadowNode.appendYogaChild(layoutablePortalShadowNode);

      // print size of layoutableHostShadowNodxe
      printf("  host size: %f x %f\n",
              layoutableHostShadowNode.getLayoutMetrics().frame.size.width,
              layoutableHostShadowNode.getLayoutMetrics().frame.size.height);
      layoutablePortalShadowNode.setSize(Size{
              .width = layoutableHostShadowNode.getLayoutMetrics().frame.size.width,
              .height = layoutableHostShadowNode.getLayoutMetrics().frame.size.height});
       // escape container size layout limitation
       layoutablePortalShadowNode.setPositionType(YGPositionTypeAbsolute);
    }

    ConcreteComponentDescriptor::adopt(shadowNode);
  }
};

} // namespace facebook::react
