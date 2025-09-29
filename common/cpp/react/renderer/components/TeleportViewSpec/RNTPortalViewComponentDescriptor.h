#pragma once

#include "RNTPortalViewShadowNode.h"

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
    
    auto& layoutablePortalShadowNode =
            static_cast<YogaLayoutableShadowNode&>(shadowNode);
    // layoutablePortalShadowNode.setSize(Size{
    //        .width = 200,
    //        .height = 200});
    
    const auto* props =
          dynamic_cast<const PortalViewProps*>(shadowNode.getProps().get());
    std::string hostName = props ? props->hostName.c_str() : "";
    
    printf("PortalViewComponentDescriptor::adopt: name='%s'\n",
           &hostName);
    
    if (!hostName.empty()) {
      std::shared_ptr<PortalHostViewShadowNode> host = PortalShadowRegistry::shared().getHost(hostName);
      printf("  host=%p\n", host.get());
      auto *rawHostPtr = host.get();
      auto& layoutableHostShadowNode =
              static_cast<YogaLayoutableShadowNode&>(*rawHostPtr);
      
      auto *concretePtr = static_cast<YogaLayoutableShadowNode*>(&shadowNode);
      std::shared_ptr<YogaLayoutableShadowNode> layoutableShared(
           concretePtr,
           [](YogaLayoutableShadowNode*) {
             /* no-op deleter: do nothing on destruction */
           });
      
      
      
      // print size of layoutableHostShadowNode
      printf("  host size: %f x %f\n",
              layoutableHostShadowNode.getLayoutMetrics().frame.size.width,
              layoutableHostShadowNode.getLayoutMetrics().frame.size.height);
      layoutablePortalShadowNode.setSize(Size{
              .width = layoutableHostShadowNode.getLayoutMetrics().frame.size.width,
              .height = layoutableHostShadowNode.getLayoutMetrics().frame.size.height});
      layoutablePortalShadowNode.setPositionType(YGPositionTypeAbsolute);
    }
    
    ConcreteComponentDescriptor::adopt(shadowNode);
  }
};

} // namespace facebook::react
