import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="home">
      <h1>Life Line</h1>
      <p>A minimalist life journey game — prototype shell.</p>
      <nav class="home__links">
        <a class="home__link" routerLink="/starting-blueprint">Roll your starting blueprint →</a>
        <a class="home__link home__link--ghost" routerLink="/character-lab">Open the Character Lab →</a>
      </nav>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .home {
      max-width: 1120px;
      margin: 0 auto;
      padding: 4rem 1.5rem;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #2f3236;
    }

    h1 {
      margin: 0 0 0.35rem;
      font-size: 2rem;
      font-weight: 600;
    }

    p {
      margin: 0 0 1.5rem;
      color: #70767e;
    }

    .home__links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .home__link {
      display: inline-block;
      padding: 0.55rem 1rem;
      border-radius: 8px;
      border: 1px solid #2f3236;
      background: #2f3236;
      color: #fff;
      text-decoration: none;
      font-size: 0.92rem;
    }

    .home__link--ghost {
      background: transparent;
      color: #2f3236;
    }
  `,
})
export class Home {}
