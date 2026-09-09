import type { Meta, StoryObj } from "@storybook/react";
import { LoginForm } from "./LoginForm";

const meta = {
  title: "Features/Auth/LoginForm",
  component: LoginForm,
  parameters: {
    layout: "centered"
  },
  tags: ["autodocs"]
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Submitting: Story = {
  args: {
    initialStatus: "submitting"
  }
};

export const Authenticated: Story = {
  args: {
    initialStatus: "authenticated",
    initialMessage: "You are signed in."
  }
};

export const InvalidCredentials: Story = {
  args: {
    initialStatus: "error",
    initialMessage: "invalid email or password"
  }
};
