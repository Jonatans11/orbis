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
    expect(screen.getByText(/ORBIS\.ID/i)).toBeInTheDocument();
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