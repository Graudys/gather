import Image from "next/image";
import logo from "@/_assets/logo.svg";
import s from "@/_styles/ui/Logo.module.css";

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className={s.logo}>
      <Image src={logo} alt="" width={size} height={size} priority />
      gather
    </span>
  );
}
