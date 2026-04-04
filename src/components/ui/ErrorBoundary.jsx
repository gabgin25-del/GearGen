import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { err: null }

  static getDerivedStateFromError(err) {
    return { err }
  }

  render() {
    if (this.state.err) {
      return (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
          Something went wrong. Try reloading the page.
        </div>
      )
    }
    return this.props.children
  }
}
