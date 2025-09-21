const mock = {
  usePortal: jest.fn().mockReturnValue({ removePortal: jest.fn() }),
  Portal: "Portal",
  PortalHost: "PortalHost",
  PortalProvider: "PortalProvider",
};

module.exports = mock;
