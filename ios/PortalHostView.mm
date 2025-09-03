#import "PortalHostView.h"

#import <react/renderer/components/TeleportViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#import <react/renderer/components/TeleportViewSpec/Props.h>
#import <react/renderer/components/TeleportViewSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface PortalHostView () <RCTPortalHostViewViewProtocol>

@end

@implementation PortalHostView {
    // UIView * _view;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<PortalHostViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const PortalHostViewProps>();
    _props = defaultProps;

    // _view = [[UIView alloc] init];

    //self.contentView = _view;
  }

  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<PortalHostViewProps const>(_props);
    const auto &newViewProps = *std::static_pointer_cast<PortalHostViewProps const>(props);

    if (oldViewProps.name != newViewProps.name) {
        std::string nameStr = newViewProps.name;
        self.accessibilityIdentifier = nameStr.empty() ? nil : [NSString stringWithUTF8String:nameStr.c_str()];
    }

    [super updateProps:props oldProps:oldProps];
}

Class<RCTComponentViewProtocol> PortalHostViewCls(void)
{
    return PortalHostView.class;
}

@end
