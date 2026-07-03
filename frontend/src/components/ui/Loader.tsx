import React from 'react'
import styles from './Loader.module.css'

export default function Loader({ fullScreen = true }: { fullScreen?: boolean }) {
  const containerClass = fullScreen 
    ? `fixed inset-0 z-[9999] bg-[#0F1219] flex items-center justify-center`
    : `flex items-center justify-center w-full h-full min-h-[200px]`

  return (
    <div className={containerClass}>
      <div className={styles.pl}>
        <div className={styles.pl__dot}></div>
        <div className={styles.pl__dot}></div>
        <div className={`${styles.pl__dot} ${styles.pl__dot__pink} ${styles.pl__dot__sm}`}></div>
        <div className={styles.pl__dot}></div>
        <div className={`${styles.pl__dot} ${styles.pl__dot__purple} ${styles.pl__dot__lg}`}></div>
        <div className={styles.pl__dot}></div>
        <div className={`${styles.pl__dot} ${styles.pl__dot__blue} ${styles.pl__dot__sm}`}></div>
        <div className={styles.pl__dot}></div>
        <div className={`${styles.pl__dot} ${styles.pl__dot__cyan} ${styles.pl__dot__sm}`}></div>
      </div>
    </div>
  )
}
