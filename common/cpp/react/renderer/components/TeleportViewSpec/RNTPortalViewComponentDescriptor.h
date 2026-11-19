#pragma once

#include "RNTPortalViewShadowNode.h"
#include "PortalShadowRegistry.h"

#include <react/debug/react_native_assert.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <react/renderer/components/view/YogaLayoutableShadowNode.h>
#include <react/renderer/runtimescheduler/RuntimeScheduler.h>
#include <react/renderer/uimanager/UIManagerBinding.h>

#include <memory>
#include <utility>

namespace facebook::react {

  class PortalViewComponentDescriptor final
      : public ConcreteComponentDescriptor<PortalViewShadowNode> {
   public:
    explicit PortalViewComponentDescriptor(
        const ComponentDescriptorParameters &parameters,
        RawPropsParser &&rawPropsParser = {})
        : ConcreteComponentDescriptor(parameters, std::move(rawPropsParser)),
          shadowTreeAccess_(std::make_shared<PortalShadowTreeAccess>()) {}

    ~PortalViewComponentDescriptor() override {
      // `UIManager` doesn't outlive the descriptors of its components
      shadowTreeAccess_->revisionProvider = nullptr;
    }

    void adopt(ShadowNode &shadowNode) const override {
      react_native_assert(dynamic_cast<PortalViewShadowNode *>(&shadowNode));

      connectToShadowTreeIfNeeded();

      auto &portalViewShadowNode = static_cast<PortalViewShadowNode &>(shadowNode);
      auto &props = static_cast<const PortalViewProps &>(*portalViewShadowNode.getProps());
      const auto &stateData =
          static_cast<const PortalViewShadowNode::ConcreteState &>(
              *portalViewShadowNode.getState())
              .getData();

      // If this portal is teleported to a host, apply the host's layout constraints
      if (!props.hostName.empty()) {
        auto &yogaPortal = static_cast<YogaLayoutableShadowNode &>(portalViewShadowNode);

        // Set position to absolute because:
        // - when the view is teleported, we need to "free" its original space
        // - we need to stretch the view beyond the parent layout constraints
        yogaPortal.setPositionType(YGPositionTypeAbsolute);

        // Native state tracks the destination host after it re-layouts (for
        // example, on rotation). The registry is the initial-layout fallback.
        HostSize hostSize{
            static_cast<float>(stateData.hostWidth),
            static_cast<float>(stateData.hostHeight)};
        auto registeredSize = PortalShadowRegistry::getInstance().getHostSize(props.hostName);
        // Right after `hostName` changes the state still describes the
        // previous host: the native side hasn't moved the children yet.
        auto isStateOfAnotherHost = registeredSize.tag != 0 && registeredSize.tag != stateData.hostTag;
        if (hostSize.width == 0 || hostSize.height == 0 || isStateOfAnotherHost) {
          hostSize = registeredSize;
        }

        portalViewShadowNode.setDimensionsFromHost(hostSize);
      }

      // The children are mounted under the host only after the native side
      // has found it, until then they are rendered (and measured) in place.
      portalViewShadowNode.setTeleported(
          !props.hostName.empty() && stateData.hostTag != 0, shadowTreeAccess_);

      ConcreteComponentDescriptor::adopt(shadowNode);
    }

   private:
    /*
     * A `ShadowNode` knows nothing about its ancestors, so the position of
     * the host has to be read from the tree. `UIManager` is reachable only
     * from the JS runtime, hence the hop through `RuntimeScheduler`.
     *
     * It can't be done in the constructor: on Android the descriptors are
     * created before `UIManagerBinding` is installed into the runtime. The
     * first node is created by a render, when the binding is already there.
     */
    void connectToShadowTreeIfNeeded() const {
      if (shadowTreeAccess_->revisionProvider.load() != nullptr ||
          shadowTreeAccess_->isConnecting.exchange(true)) {
        return;
      }

      auto weakRuntimeScheduler =
          contextContainer_->find<std::weak_ptr<RuntimeScheduler>>(RuntimeSchedulerKey);
      auto runtimeScheduler =
          weakRuntimeScheduler.has_value() ? weakRuntimeScheduler.value().lock() : nullptr;
      if (runtimeScheduler == nullptr) {
        shadowTreeAccess_->isConnecting = false;
        return;
      }

      runtimeScheduler->scheduleWork(
          [weakAccess = std::weak_ptr<PortalShadowTreeAccess>(shadowTreeAccess_)](
              jsi::Runtime &runtime) {
            auto access = weakAccess.lock();
            if (access == nullptr) {
              return;
            }

            if (auto binding = UIManagerBinding::getBinding(runtime)) {
              access->revisionProvider = binding->getUIManager().getShadowTreeRevisionProvider();
            }
            access->isConnecting = false;
          });
    }

    std::shared_ptr<PortalShadowTreeAccess> shadowTreeAccess_;
  };

} // namespace facebook::react
