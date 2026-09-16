import * as React from "react";

export interface IconLabelProps {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
}

export const IconLabel: React.FC<IconLabelProps> = ({ icon, label }) => {
  return React.createElement("span", null, icon, label);
};
