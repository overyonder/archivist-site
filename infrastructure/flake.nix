{
  description = "Pinned tools for Archivist infrastructure deployment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }: {
    devShells.x86_64-linux.supabase =
      let
        pkgs = nixpkgs.legacyPackages.x86_64-linux;
      in
      pkgs.mkShellNoCC {
        packages = [ pkgs.supabase-cli ];
      };
  };
}
