{
  description = "Pinned tools for Archivist infrastructure deployment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
    in
    {
      devShells.x86_64-linux.resend = pkgs.mkShellNoCC {
        packages = [
          pkgs.bash
          pkgs.coreutils
          pkgs.curl
          pkgs.jq
        ];
      };

      devShells.x86_64-linux.supabase = pkgs.mkShellNoCC {
        packages = [ pkgs.supabase-cli ];
      };
    };
}
