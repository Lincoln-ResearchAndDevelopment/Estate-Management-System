import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusPill } from "./status-pill";
import { Pagination } from "./data-table";
import { Button } from "./button";

describe("StatusPill", () => {
  it("labels an approved listing as Live", () => {
    render(<StatusPill status="approved" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("humanises unknown statuses", () => {
    render(<StatusPill status="under_review" />);
    expect(screen.getByText("Under review")).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("shows the range and moves to the next page (FR-GEN-01)", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} totalPages={3} total={25} pageSize={10} onPageChange={onPageChange} />);
    expect(screen.getByText("1–10")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables Previous on the first page", () => {
    render(<Pagination page={1} totalPages={3} total={25} pageSize={10} onPageChange={() => undefined} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });
});

describe("Button", () => {
  it("is disabled and busy while loading", () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
