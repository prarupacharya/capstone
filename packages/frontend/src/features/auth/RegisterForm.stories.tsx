import type { Meta, StoryObj } from "@storybook/react";
import { RegisterForm } from "./RegisterForm";

const meta = {
  title: "Features/Auth/RegisterForm",
  component: RegisterForm,
  parameters: {
    layout: "centered"
  },
  tags: ["autodocs"]
} satisfies Meta<typeof RegisterForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Submitting: Story = {
  args: {
    initialStatus: "submitting"
  }
};

export const Success: Story = {
  args: {
    initialStatus: "success",
    initialMessage: "Account created for user@example.com."
  }
};

export const Error: Story = {
  args: {
    initialStatus: "error",
    initialMessage: "email is already registered"
  }
};
