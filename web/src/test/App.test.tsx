import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Landing from "../pages/Landing";

describe("Landing page", () => {
  it("renders the ORBIS.ID brand heading", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );
    // There are multiple "ORBIS.ID" references (Wordmark nav + body text),
    // so use getAllByText and assert at least one exists
    const matches = screen.getAllByText(/ORBIS\.ID/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders without crashing", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );
    expect(document.body).toBeTruthy();
  });
});