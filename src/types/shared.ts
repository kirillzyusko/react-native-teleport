export type PortalProviderProps = {
  children: React.ReactNode;
};
export type PortalHostProps<Style> = {
  name: string;
  style?: Style;
  children?: React.ReactNode;
};
export type PortalProps<Style> = {
  name?: string;
  hostName?: string;
  style?: Style;
  children?: React.ReactNode;
};
